// Local integration workload: real HTTP, accounts, MongoDB and Socket.IO; no browser rendering.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { MongoClient, ObjectId } = require('mongodb');
const { io } = require('../apps/web/node_modules/socket.io-client');
const base = 'http://localhost:8000';
const tag = Date.now();
const users = [],
  clients = [],
  timings = [],
  backgroundErrors = [];
let mongo,
  roomId,
  collect = false;

async function request(user, method, path, body, expected = 200) {
  const started = performance.now();
  const response = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(user ? { authorization: `Bearer ${user.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (collect) timings.push({ path, ms: performance.now() - started });
  assert.equal(response.status, expected, `${method} ${path}: ${result.message || result.status}`);
  return result.data;
}
const api = (user, method, path, body, expected) =>
  request(user, method, '/api/v1/quiz' + path, body, expected);

async function createAccount(index) {
  const email = `quiz-load-${tag}-${index}@example.com`;
  const data = await request(null, 'POST', '/api/v1/users/signup', {
    first_name: 'Load',
    last_name: 'Student' + index,
    email,
    password: 'PtitDemo@2026',
    passwordConfirm: 'PtitDemo@2026',
    gender: 'male',
    birth_Year: 2003,
    birth_Month: 1,
    birth_Day: 15,
  });
  const user = { ...data.user, token: data.token, email };
  users.push(user);
  return user;
}

async function connect(client) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Socket subscribe timeout')), 10000);
    client.socket.once('connect', () =>
      client.socket.emit('room:subscribe', { roomId }, (ack) => {
        clearTimeout(timer);
        ack.ok ? resolve() : reject(Error('Socket permission rejected'));
      })
    );
    client.socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    client.socket.connect();
  });
}

function makeClient(user) {
  const client = { user, updates: 0, busy: false, pending: null, timer: null, poll: null };
  client.socket = io(base, {
    path: '/quiz-socket',
    auth: { token: user.token },
    transports: ['websocket'],
    autoConnect: false,
    reconnection: false,
  });
  client.refresh = () => {
    if (!collect || client.busy) return;
    client.busy = true;
    client.pending = api(user, 'GET', `/rooms/${roomId}`)
      .catch((error) => backgroundErrors.push(error.message))
      .finally(() => {
        client.busy = false;
      });
  };
  client.socket.on('room:updated', () => {
    client.updates++;
    // Coalesce notification bursts, and keep at most one state read in flight per client.
    if (!collect || client.timer) return;
    client.timer = setTimeout(() => {
      client.timer = null;
      client.refresh();
    }, 300);
  });
  client.poll = setInterval(client.refresh, 2000);
  clients.push(client);
  return client;
}

async function stopClients() {
  collect = false;
  for (const client of clients) {
    clearInterval(client.poll);
    clearTimeout(client.timer);
    client.socket.disconnect();
  }
  await Promise.allSettled(clients.map((client) => client.pending));
}

async function main() {
  mongo = new MongoClient('mongodb://127.0.0.1:27017');
  await mongo.connect();
  console.log('Creating 31 temporary verified accounts (one host, 30 players)...');
  // Keep account setup modest; concurrency is tested during room operations.
  for (let index = 0; index < 31; index++) await createAccount(index);
  const inbox = await (await fetch('http://localhost:8025/api/v1/messages?limit=100')).json();
  for (const user of users) {
    const mail = inbox.messages.find((message) =>
      message.To.some((to) => to.Address === user.email)
    );
    assert(mail, 'Verification email for temporary account');
    user.mailId = mail.ID;
    const detail = await (await fetch(`http://localhost:8025/api/v1/message/${mail.ID}`)).json();
    const token = (detail.Text || detail.HTML).match(/\/activate\/([a-f0-9]+)/)[1];
    await request(user, 'POST', '/api/v1/users/emailVerification', { token }, 201);
  }
  const host = users[0],
    players = users.slice(1);
  const questions = Array.from({ length: 5 }, (_, index) => ({
    id: 'load-q' + index,
    text: 'Load test question ' + index,
    options: ['First', 'Second', 'Third', 'Fourth'],
    correctIndices: index === 0 ? [0, 1] : [0],
    timeLimit: 120,
    explanation: 'Local test fixture',
  }));
  const quiz = (
    await api(
      host,
      'POST',
      '/quizzes',
      { title: 'Load fixture ' + tag, status: 'ready', visibility: 'private', questions },
      201
    )
  ).quiz;
  const room = (
    await api(host, 'POST', '/rooms', { quizId: quiz._id, maxPlayers: 30, speedBonus: false }, 201)
  ).room;
  roomId = room.id;
  const started = performance.now();
  collect = true;
  console.log('Joining 30 players concurrently, then opening 31 real WebSockets...');
  await Promise.all(players.map((user) => api(user, 'POST', '/rooms/join', { code: room.code })));
  const lobby = await api(host, 'GET', `/rooms/${roomId}`);
  assert.equal(lobby.players.length, 30);
  assert.equal(new Set(lobby.players.map((player) => player.userId)).size, 30);
  await Promise.all(users.map((user) => connect(makeClient(user))));
  await api(host, 'POST', `/rooms/${roomId}/start`, {});
  for (let round = 0; round < questions.length; round++) {
    console.log(
      `Concurrent round ${round + 1}/5 (state reads, answers, next; live updates + polling)...`
    );
    if (round === 2) {
      const deadline = (await api(players[0], 'GET', `/rooms/${roomId}`)).question.deadline;
      const reconnecting = clients.slice(1, 6);
      reconnecting.forEach((client) => client.socket.disconnect());
      await Promise.all(reconnecting.map(connect));
      assert.equal((await api(players[0], 'GET', `/rooms/${roomId}`)).question.deadline, deadline);
    }
    await Promise.all(
      players.map(async (user, index) => {
        const state = await api(user, 'GET', `/rooms/${roomId}`);
        assert.equal(state.question.id, questions[round].id);
        assert(!JSON.stringify(state.question).includes('correctIndices'));
        const wrong = round === 1 && index % 5 === 0;
        const body = {
          questionId: questions[round].id,
          selectedIndices: wrong ? [3] : questions[round].correctIndices,
        };
        const result = await api(user, 'POST', `/rooms/${roomId}/answer`, body);
        assert.equal(result.feedback.correct, !wrong);
        if (round === 0) {
          const duplicate = await api(user, 'POST', `/rooms/${roomId}/answer`, body);
          assert.equal(duplicate.attempt.score, 700);
          assert.equal(duplicate.attempt.answeredCount, 1);
        }
        await api(user, 'POST', `/rooms/${roomId}/next`, { questionId: questions[round].id });
      })
    );
  }
  const final = await api(host, 'GET', `/rooms/${roomId}`);
  assert.equal(final.room.status, 'finished');
  assert.equal(final.players.length, 30);
  players.forEach((user, index) => {
    const player = final.players.find((player) => player.userId === user._id);
    assert.equal(player.answeredCount, 5);
    assert.equal(player.score, index % 5 === 0 ? 2800 : 3500);
  });
  assert(
    clients.every((client) => client.updates > 0),
    'All sockets received updates'
  );
  assert.equal(backgroundErrors.length, 0, backgroundErrors.slice(0, 3).join('\n'));
  const elapsedSeconds = Math.round((performance.now() - started) / 100) / 10;
  await stopClients();
  assert.equal(backgroundErrors.length, 0, backgroundErrors.slice(0, 3).join('\n'));
  const values = timings.map((timing) => timing.ms).sort((a, b) => a - b);
  const report = {
    players: 30,
    webSockets: 31,
    questions: 5,
    requests: values.length,
    elapsedSeconds,
    p95Ms: Math.round(values[Math.ceil(values.length * 0.95) - 1]),
    maxMs: Math.round(values[values.length - 1]),
    failures: backgroundErrors.length,
    correctness: 'All 30 scores, duplicate submissions and reconnect deadlines matched',
    scope: 'Local HTTP + Socket.IO with coalesced refresh/polling; not 30 rendered browsers',
    testedAt: new Date().toISOString(),
  };
  fs.mkdirSync('.local-logs', { recursive: true });
  fs.writeFileSync('.local-logs/quiz-load-report.json', JSON.stringify(report, null, 2));
  console.log('PASS ' + JSON.stringify(report));
}

async function cleanup() {
  await stopClients();
  if (!mongo) return;
  const ids = users.map((user) => new ObjectId(user._id)),
    userIds = users.map((user) => user._id);
  const db = mongo.db('ptitsocial_quiz');
  const rooms = await db
    .collection('quizrooms')
    .find({ 'host.id': { $in: userIds } })
    .project({ _id: 1 })
    .toArray();
  await db
    .collection('quizattempts')
    .deleteMany({ roomId: { $in: rooms.map((room) => room._id) } });
  await db.collection('quizrooms').deleteMany({ 'host.id': { $in: userIds } });
  await db.collection('quizzes').deleteMany({ ownerId: { $in: userIds } });
  await mongo
    .db('ptitsocial_accounts')
    .collection('users')
    .deleteMany({ _id: { $in: ids } });
  for (const domain of ['content', 'messaging'])
    await mongo
      .db('ptitsocial_' + domain)
      .collection('user_projections')
      .deleteMany({ _id: { $in: ids } });
  for (const user of users)
    if (user.mailId)
      await fetch(`http://localhost:8025/api/v1/messages/${user.mailId}`, { method: 'DELETE' });
  await mongo.close();
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
