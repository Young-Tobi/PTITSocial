const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { MongoClient, ObjectId } = require('mongodb');
const { io } = require('../apps/web/node_modules/socket.io-client');
const base = 'http://localhost:8000',
  prefix = '/api/v1/coding',
  tag = Date.now(),
  users = [],
  sockets = [];
const mongo = new MongoClient('mongodb://127.0.0.1:27017');
async function request(user, method, path, body, expected = 200) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(user ? { authorization: `Bearer ${user.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
  return result.data;
}
const api = (user, method, path, body, expected) =>
  request(user, method, prefix + path, body, expected);
async function account(index) {
  const email = `coding-test-${tag}-${index}@example.com`;
  const result = await request(null, 'POST', '/api/v1/users/signup', {
    first_name: 'Coding',
    last_name: 'Tester' + index,
    email,
    password: 'PtitDemo@2026',
    passwordConfirm: 'PtitDemo@2026',
    gender: 'male',
    birth_Year: 2003,
    birth_Month: 1,
    birth_Day: 15,
  });
  const user = { ...result.user, token: result.token, email };
  users.push(user);
  await api(user, 'GET', '/rooms', undefined, 403);
  const inbox = await (await fetch('http://localhost:8025/api/v1/messages?limit=100')).json();
  const mail = inbox.messages.find((message) => message.To.some((to) => to.Address === email));
  assert(mail);
  user.mailId = mail.ID;
  const detail = await (await fetch('http://localhost:8025/api/v1/message/' + mail.ID)).json();
  await request(
    user,
    'POST',
    '/api/v1/users/emailVerification',
    { token: (detail.Text || detail.HTML).match(/\/activate\/([a-f0-9]+)/)[1] },
    201
  );
  return user;
}
async function connect(user, roomId, allowed = true) {
  const socket = io(base, {
    path: '/coding-socket',
    auth: { token: user.token },
    transports: ['websocket'],
    reconnection: false,
  });
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Coding socket timeout')), 8000);
    socket.once('connect_error', reject);
    socket.once('connect', () =>
      socket.emit('room:subscribe', { roomId }, (ack) => {
        clearTimeout(timer);
        assert.equal(!!ack.ok, allowed, JSON.stringify(ack));
        resolve();
      })
    );
  });
  return socket;
}
const db = () => mongo.db('ptitsocial_coding');
const state = (user, id) => api(user, 'GET', '/rooms/' + id);
async function waitJob(user, id, jobId) {
  for (let index = 0; index < 120; index++) {
    const data = await state(user, id),
      job = data.submissions.find((item) => item.id === jobId);
    if (job && ['done', 'error'].includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw Error('Judging timeout');
}
async function send(user, roomId, problemId, code, mode = 'submit') {
  const body = { code, problemId, requestId: randomUUID() },
    result = await api(user, 'POST', `/rooms/${roomId}/${mode}`, body, 202);
  return { ...result, body };
}
const sumCode =
  '#include <bits/stdc++.h>\nusing namespace std; int main(){int n;cin>>n;long long s=0,x;while(n--){cin>>x;s+=x;}cout<<s;}';
const palindromeCode =
  '#include <bits/stdc++.h>\nusing namespace std; int main(){string s;cin>>s;string t=s;reverse(t.begin(),t.end());cout<<(s==t?"YES":"NO");}';
async function main() {
  await mongo.connect();
  const host = await account(1),
    a = await account(2),
    b = await account(3),
    outsider = await account(4);
  await api(null, 'GET', '/rooms', undefined, 401);
  assert.equal((await api(host, 'GET', '/status')).ready, true);
  const catalog = await api(host, 'GET', '/problems');
  assert(!JSON.stringify(catalog).includes('"tests"'));
  const sum = catalog.problems.find((p) => p.title === 'Tổng dãy số').id,
    pal = catalog.problems.find((p) => p.title === 'Chuỗi đối xứng').id;
  const settings = {
    title: 'Coding integration ' + tag,
    durationMinutes: 5,
    maxPlayers: 2,
    problemIds: [sum, pal],
  };
  for (const change of [
    { problemIds: [] },
    { problemIds: [sum, sum] },
    { problemIds: [new ObjectId().toString()] },
    { visibility: 'hidden' },
  ])
    await api(host, 'POST', '/rooms', { ...settings, ...change }, 400);
  const privateRoom = (
    await api(
      host,
      'POST',
      '/rooms',
      { ...settings, visibility: 'private', problemIds: [pal, sum] },
      201
    )
  ).room;
  let data = await state(host, privateRoom.id);
  assert.equal(data.players.length, 0);
  assert.deepEqual(
    data.problems.map((p) => p.id),
    [pal, sum]
  );
  assert(!(await api(outsider, 'GET', '/rooms')).rooms.some((r) => r.id === privateRoom.id));
  assert((await api(host, 'GET', '/rooms?view=mine')).rooms.some((r) => r.id === privateRoom.id));
  await api(outsider, 'GET', '/rooms/' + privateRoom.id, undefined, 403);
  await api(outsider, 'POST', `/rooms/${privateRoom.id}/join`, {}, 403);
  await api(host, 'POST', '/rooms/join', { code: privateRoom.code }, 403);
  await api(host, 'POST', `/rooms/${privateRoom.id}/start`, {}, 400);
  await api(
    host,
    'POST',
    `/rooms/${privateRoom.id}/submit`,
    { code: sumCode, problemId: sum, requestId: randomUUID() },
    403
  );
  await api(a, 'POST', '/rooms/join', { code: privateRoom.code });
  assert.equal((await state(a, privateRoom.id)).problems.length, 0);
  const seatResults = await Promise.all(
    [b, outsider].map(async (user) => {
      const response = await fetch(base + prefix + '/rooms/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + user.token },
        body: JSON.stringify({ code: privateRoom.code }),
      });
      return { user, status: response.status };
    })
  );
  assert.deepEqual(seatResults.map((r) => r.status).sort(), [200, 409]);
  const accepted = seatResults.find((r) => r.status === 200).user,
    rejected = seatResults.find((r) => r.status === 409).user;
  await api(host, 'POST', `/rooms/${privateRoom.id}/kick`, { userId: accepted._id });
  await api(accepted, 'POST', '/rooms/join', { code: privateRoom.code }, 403);
  await api(accepted, 'GET', '/rooms/' + privateRoom.id, undefined, 403);
  await connect(accepted, privateRoom.id, false);
  await api(a, 'POST', `/rooms/${privateRoom.id}/leave`, {});
  assert.equal((await state(host, privateRoom.id)).players.length, 0);
  await api(rejected, 'POST', '/rooms/join', { code: privateRoom.code });
  assert.equal((await state(host, privateRoom.id)).players.length, 1);
  await api(host, 'POST', `/rooms/${privateRoom.id}/end`, {});
  console.log(
    'PASS organizer separate, private discovery/code access, ordered problem selection, hidden lobby, concurrent last seat, kick and leave'
  );
  const room = (await api(host, 'POST', '/rooms', { ...settings, visibility: 'public' }, 201)).room;
  const discovery = (await api(outsider, 'GET', '/rooms')).rooms.find((r) => r.id === room.id);
  assert(discovery);
  assert.equal(discovery.code, undefined);
  assert.equal(discovery.problemCount, 2);
  assert.equal(discovery.playerCount, 0);
  await api(a, 'POST', `/rooms/${room.id}/join`, {});
  await api(b, 'POST', `/rooms/${room.id}/join`, {});
  await api(outsider, 'POST', `/rooms/${room.id}/join`, {}, 409);
  await api(a, 'POST', `/rooms/${room.id}/start`, {}, 403);
  await api(a, 'POST', `/rooms/${room.id}/end`, {}, 403);
  await api(a, 'POST', `/rooms/${room.id}/kick`, { userId: b._id }, 403);
  await connect(host, room.id);
  await connect(a, room.id);
  await connect(b, room.id);
  const started = await api(host, 'POST', `/rooms/${room.id}/start`, {});
  assert.deepEqual((await state(a, room.id)).problems, started.problems);
  assert.deepEqual(
    started.problems.map((p) => p.id),
    [sum, pal]
  );
  assert(!JSON.stringify(started).includes('"tests"'));
  await api(host, 'POST', `/rooms/${room.id}/kick`, { userId: b._id }, 409);
  await api(outsider, 'POST', '/rooms/join', { code: room.code }, 409);
  await api(
    a,
    'POST',
    `/rooms/${room.id}/run`,
    { code: sumCode, problemId: new ObjectId().toString(), requestId: randomUUID() },
    400
  );
  const privateCode = sumCode + '\n// private-source-' + tag;
  let submitted = await send(a, room.id, sum, privateCode, 'run');
  await api(
    a,
    'POST',
    `/rooms/${room.id}/run`,
    { code: sumCode, problemId: pal, requestId: randomUUID() },
    409
  );
  const duplicate = await api(a, 'POST', `/rooms/${room.id}/run`, submitted.body, 202);
  assert.equal(duplicate.id, submitted.id);
  let job = await waitJob(a, room.id, submitted.id);
  assert.equal(job.status, 'done', JSON.stringify(job));
  assert.equal(job.passed, 1, JSON.stringify(job));
  assert.equal((await state(a, room.id)).leaderboard.find((row) => row.userId === a._id).points, 0);
  await api(host, 'GET', `/submissions/${submitted.id}/code`, undefined, 404);
  await api(b, 'GET', `/submissions/${submitted.id}/code`, undefined, 404);
  assert.equal((await api(a, 'GET', `/submissions/${submitted.id}/code`)).code, privateCode);
  assert(!JSON.stringify(await state(host, room.id)).includes('private-source-' + tag));
  assert.equal((await state(b, room.id)).submissions.length, 0);
  console.log(
    'PASS public discovery, start restrictions, same problem snapshots, real C++17 sample run, idempotency, source/hidden-test privacy'
  );
  submitted = await send(a, room.id, sum, '#include <iostream>\nint main(){std::cout<<15;}');
  job = await waitJob(a, room.id, submitted.id);
  assert.equal(job.points, 25, JSON.stringify(job));
  assert.equal(job.results, undefined);
  submitted = await send(a, room.id, sum, 'this is not cpp');
  job = await waitJob(a, room.id, submitted.id);
  assert.equal(job.verdict, 'Lỗi biên dịch');
  assert(job.compileOutput);
  submitted = await send(a, room.id, sum, 'int main(){volatile int x=0;while(true)x++;}', 'run');
  job = await waitJob(a, room.id, submitted.id);
  assert.equal(job.results[0].status, 'Time Limit Exceeded', JSON.stringify(job));
  submitted = await send(a, room.id, sum, sumCode);
  job = await waitJob(a, room.id, submitted.id);
  assert.equal(job.points, 100, JSON.stringify(job));
  data = await state(a, room.id);
  assert.equal(data.me.solved, false);
  assert.equal(data.room.status, 'running');
  submitted = await send(a, room.id, pal, '#include <iostream>\nint main(){std::cout<<"YES";}');
  job = await waitJob(a, room.id, submitted.id);
  assert.equal(job.points, 50, JSON.stringify(job));
  assert.equal((await state(a, room.id)).leaderboard.find((p) => p.userId === a._id).points, 150);
  assert(!(await state(host, room.id)).leaderboard.some((p) => p.userId === host._id));
  assert((await state(host, room.id)).activity.length > 0);
  console.log(
    'PASS per-problem partial points, hidden tests, compile errors, timeout, solving one problem keeps other problems open, best total and organizer rankings'
  );
  for (const [id, code] of [
    [sum, sumCode],
    [pal, palindromeCode],
  ]) {
    submitted = await send(b, room.id, id, code);
    job = await waitJob(b, room.id, submitted.id);
    assert.equal(job.points, 100, JSON.stringify(job));
  }
  submitted = await send(a, room.id, pal, palindromeCode);
  await api(host, 'POST', `/rooms/${room.id}/end`, {});
  assert.equal((await state(host, room.id)).room.status, 'running');
  await api(
    a,
    'POST',
    `/rooms/${room.id}/submit`,
    { code: palindromeCode, problemId: pal, requestId: randomUUID() },
    409
  );
  job = await waitJob(a, room.id, submitted.id);
  assert.equal(job.points, 100, JSON.stringify(job));
  data = await state(host, room.id);
  assert.equal(data.room.status, 'finished');
  assert.equal(data.leaderboard.length, 2);
  assert.equal(data.leaderboard[0].userId, b._id);
  assert.equal(data.leaderboard[0].points, 200);
  assert.equal(data.leaderboard[1].points, 200);
  assert((await api(a, 'GET', '/rooms?view=history')).rooms.some((r) => r.id === room.id));
  assert(!(await api(outsider, 'GET', '/rooms')).rooms.some((r) => r.id === room.id));
  console.log(
    'PASS queued work completes after cutoff, late submits blocked, total-score tie uses receipt time, final results/history'
  );
  const replay = (
    await api(host, 'POST', '/rooms', { ...settings, title: 'Replay ' + tag, maxPlayers: 3 }, 201)
  ).room;
  assert.notEqual(replay.id, room.id);
  assert.notEqual(replay.code, room.code);
  await api(a, 'POST', `/rooms/${replay.id}/join`, {});
  await api(b, 'POST', `/rooms/${replay.id}/join`, {});
  await api(host, 'POST', `/rooms/${replay.id}/start`, {});
  await api(outsider, 'POST', `/rooms/${replay.id}/join`, {}, 409);
  await api(a, 'POST', `/rooms/${replay.id}/leave`, {});
  await api(
    a,
    'POST',
    `/rooms/${replay.id}/submit`,
    { code: sumCode, problemId: sum, requestId: randomUUID() },
    409
  );
  await api(host, 'POST', `/rooms/${replay.id}/end`, {});
  const expired = (await api(host, 'POST', '/rooms', { ...settings, title: 'Expired ' + tag }, 201))
    .room;
  await db()
    .collection('codingrooms')
    .updateOne(
      { _id: new ObjectId(expired.id) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );
  assert.equal((await state(host, expired.id)).room.status, 'finished');
  await api(outsider, 'POST', `/rooms/${expired.id}/join`, {}, 409);
  console.log(
    'PASS new-room replay, no join after start even with spare seats, withdrawal, waiting-room expiry'
  );
}
async function cleanup() {
  sockets.forEach((socket) => socket.close());
  const ids = users.map((user) => new ObjectId(user._id)),
    strings = users.map((user) => user._id);
  const rooms = await db()
    .collection('codingrooms')
    .find({ hostId: { $in: strings } })
    .project({ _id: 1 })
    .toArray();
  await db()
    .collection('codingsubmissions')
    .deleteMany({ roomId: { $in: rooms.map((r) => r._id) } });
  await db()
    .collection('codingrooms')
    .deleteMany({ hostId: { $in: strings } });
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
      await fetch('http://localhost:8025/api/v1/messages/' + user.mailId, { method: 'DELETE' });
  await mongo.close();
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(cleanup);
