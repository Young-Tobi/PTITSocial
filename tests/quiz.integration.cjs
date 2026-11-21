const assert = require('node:assert/strict');
const { MongoClient, ObjectId } = require('mongodb');
const { io } = require('../apps/web/node_modules/socket.io-client');
const base = 'http://localhost:8000';
const prefix = '/api/v1/quiz';
const tag = Date.now();
const users = [],
  sockets = [];
let mongo;
async function request(user, method, path, body, expected = 200) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(user ? { authorization: `Bearer ${user.token}` } : {}),
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${result.message || result.status}`);
  return result.data;
}
const api = (user, method, path, body, expected) =>
  request(user, method, prefix + path, body, expected);
async function account(index) {
  const email = `quiz-test-${tag}-${index}@example.com`;
  const data = await request(null, 'POST', '/api/v1/users/signup', {
    first_name: 'Quiz',
    last_name: `Tester${index}`,
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
  await api(user, 'GET', '/quizzes', undefined, 403);
  const inbox = await (await fetch('http://localhost:8025/api/v1/messages?limit=100')).json();
  const mail = inbox.messages.find((message) => message.To.some((to) => to.Address === email));
  assert(mail, 'signup email');
  user.mailId = mail.ID;
  const detail = await (await fetch(`http://localhost:8025/api/v1/message/${mail.ID}`)).json();
  const token = (detail.Text || detail.HTML).match(/\/activate\/([a-f0-9]+)/)[1];
  await request(user, 'POST', '/api/v1/users/emailVerification', { token }, 201);
  return user;
}
async function socket(user, roomId) {
  const client = io(base, {
    path: '/quiz-socket',
    auth: { token: user.token },
    transports: ['websocket'],
    reconnection: false,
  });
  sockets.push(client);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('quiz websocket timeout')), 6000);
    client.once('connect', () =>
      client.emit('room:subscribe', { roomId }, (ack) => {
        clearTimeout(timer);
        ack.ok ? resolve() : reject(Error(JSON.stringify(ack)));
      })
    );
    client.once('connect_error', reject);
  });
  return client;
}
const question = (id, timeLimit = 30) => ({
  id,
  text: `Câu ${id}: 2 + 2 = ?`,
  options: ['1', '2', '3', '4'],
  correctIndex: 3,
  timeLimit,
  explanation: '2 cộng 2 bằng 4.',
});
async function main() {
  mongo = new MongoClient('mongodb://127.0.0.1:27017');
  await mongo.connect();
  const host = await account(1),
    a = await account(2),
    b = await account(3);
  await api(null, 'GET', '/quizzes', undefined, 401);
  const body = {
    title: `Quiz integration ${tag}`,
    status: 'ready',
    visibility: 'private',
    questions: [question('one'), question('two')],
  };
  const { quiz } = await api(host, 'POST', '/quizzes', body, 201);
  await api(a, 'GET', `/quizzes/${quiz._id}`, undefined, 404);
  await api(a, 'POST', '/rooms', { quizId: quiz._id }, 404);
  await api(host, 'POST', '/quizzes', { ...body, questions: [] }, 400);
  await api(host, 'PUT', `/quizzes/${quiz._id}`, { ...body, visibility: 'public' });
  const discovery = await api(a, 'GET', '/quizzes?view=discover');
  assert(discovery.quizzes.some((q) => q.id === quiz._id));
  assert(!JSON.stringify(discovery).includes('correctIndex'));
  const { room } = await api(
    host,
    'POST',
    '/rooms',
    { quizId: quiz._id, maxPlayers: 2, speedBonus: false },
    201
  );
  assert.match(room.code, /^\d{6}$/);
  assert.equal(room.questions, undefined);
  await api(host, 'POST', `/rooms/${room.id}/start`, {}, 400);
  await api(a, 'POST', '/rooms/join', { code: room.code });
  await api(b, 'POST', '/rooms/join', { code: room.code });
  await api(a, 'POST', `/rooms/${room.id}/start`, {}, 403);
  const ws = await socket(host, room.id);
  const malformed = await new Promise((resolve) => ws.emit('room:subscribe', null, resolve));
  assert(malformed.error, 'Malformed subscription is rejected without crashing');
  const denied = await new Promise((resolve) =>
    ws.emit('room:subscribe', { roomId: new ObjectId().toString() }, resolve)
  );
  assert(denied.error, 'Unknown room cannot be subscribed');
  const event = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('missing room update')), 5000);
    ws.once('room:updated', (message) => {
      clearTimeout(timer);
      resolve(message);
    });
  });
  await api(host, 'POST', `/rooms/${room.id}/start`, {});
  assert.equal((await event).roomId, room.id);
  // Existing rooms retain their own question snapshot after the author edits the source.
  await api(host, 'PUT', `/quizzes/${quiz._id}`, {
    ...body,
    questions: [{ ...question('one'), text: 'Changed source' }],
  });
  const state = await api(a, 'GET', `/rooms/${room.id}`);
  assert.equal(state.question.text, body.questions[0].text);
  assert(!JSON.stringify(state).includes('correctIndex'));
  assert(!JSON.stringify(state).includes('explanation'));
  await api(a, 'GET', `/rooms/${room.id}/results`, undefined, 403);
  const answer = { questionId: 'one', selectedIndex: 3 };
  const duplicates = await Promise.all(
    Array.from({ length: 6 }, () => api(a, 'POST', `/rooms/${room.id}/answer`, answer))
  );
  assert(
    duplicates.every((result) => result.attempt.score === 700 && result.attempt.answeredCount === 1)
  );
  assert.equal(duplicates[0].feedback.correctIndex, 3);
  const bState = await api(b, 'GET', `/rooms/${room.id}`);
  assert.equal(bState.attempt.cursor, 0);
  assert.equal(bState.feedback, undefined);
  await api(a, 'POST', `/rooms/${room.id}/next`, { questionId: 'one' });
  const resumed = await api(a, 'GET', `/rooms/${room.id}`);
  assert.equal(resumed.question.id, 'two');
  assert.equal(resumed.attempt.score, 700);
  await api(a, 'POST', `/rooms/${room.id}/answer`, { questionId: 'two', selectedIndex: 3 });
  await api(a, 'POST', `/rooms/${room.id}/next`, { questionId: 'two' });
  const partial = await api(a, 'GET', `/rooms/${room.id}/results`);
  assert.equal(partial.isFinal, false);
  assert.equal(partial.selected.score, 1400);
  await api(a, 'GET', `/rooms/${room.id}/results?userId=${b._id}`, undefined, 403);
  await api(b, 'POST', `/rooms/${room.id}/answer`, { questionId: 'one', selectedIndex: 0 });
  await api(b, 'POST', `/rooms/${room.id}/next`, { questionId: 'one' });
  const attemptCollection = mongo.db('ptitsocial_quiz').collection('quizattempts');
  await attemptCollection.updateOne(
    { roomId: new ObjectId(room.id), userId: b._id },
    { $set: { questionStartedAt: new Date(Date.now() - 31000) } }
  );
  const expired = await api(b, 'GET', `/rooms/${room.id}`);
  assert.equal(expired.feedback.timedOut, true);
  assert.equal(expired.feedback.points, 0);
  assert.equal(expired.room.status, 'finished');
  const late = await api(b, 'POST', `/rooms/${room.id}/answer`, {
    questionId: 'two',
    selectedIndex: 3,
  });
  assert.equal(late.attempt.score, 0);
  const results = await api(host, 'GET', `/rooms/${room.id}/results?userId=${a._id}`);
  assert.equal(results.selected.rank, 1);
  assert.equal(results.review.length, 2);
  assert.equal(results.isFinal, true);
  console.log(
    'PASS live sockets, independent progress, answer privacy, snapshot, concurrent duplicate submission, refresh, timeout and final review'
  );
  const room2 = (await api(host, 'POST', '/rooms', { quizId: quiz._id, maxPlayers: 1 }, 201)).room;
  await api(a, 'POST', '/rooms/join', { code: room2.code });
  await api(b, 'POST', '/rooms/join', { code: room2.code }, 409);
  await api(host, 'DELETE', `/rooms/${room2.id}/players/${a._id}`);
  await api(a, 'POST', '/rooms/join', { code: room2.code }, 403);
  await api(a, 'GET', `/rooms/${room2.id}`, undefined, 403);
  await api(b, 'POST', '/rooms/join', { code: room2.code });
  await api(host, 'POST', `/rooms/${room2.id}/start`, {});
  await api(
    host,
    'POST',
    `/rooms/${room2.id}/answer`,
    { questionId: 'one', selectedIndex: 3 },
    403
  );
  await api(host, 'POST', `/rooms/${room2.id}/end`, {});
  assert.equal((await api(b, 'GET', `/rooms/${room2.id}/results`)).review[0].answer, null);
  await api(host, 'DELETE', `/quizzes/${quiz._id}`);
  assert.equal((await api(host, 'GET', `/rooms/${room.id}/results`)).review.length, 2);
  const history = await api(a, 'GET', '/history');
  assert(history.rooms.some((item) => item.id === room.id));
  assert(!JSON.stringify(history).includes('correctIndex'));
  await api(host, 'GET', '/rooms/not-an-id', undefined, 400);
  console.log(
    'PASS capacity, host permissions, kick, early end, delete retains results, history and invalid IDs'
  );
  const multiQuiz = (
    await api(
      host,
      'POST',
      '/quizzes',
      {
        ...body,
        title: 'Multi ' + tag,
        questions: ['m1', 'm2', 'm3'].map((id) => ({ ...question(id), correctIndices: [0, 1] })),
      },
      201
    )
  ).quiz;
  const multi = (
    await api(host, 'POST', '/rooms', { quizId: multiQuiz._id, speedBonus: false }, 201)
  ).room;
  for (const user of [a, b]) await api(user, 'POST', '/rooms/join', { code: multi.code });
  await api(host, 'POST', `/rooms/${multi.id}/start`, {});
  const privateState = await api(a, 'GET', `/rooms/${multi.id}`);
  assert.equal(privateState.question.selectionMode, 'multiple');
  assert(!JSON.stringify(privateState).includes('correctIndices'));
  for (const selectedIndices of [[], [0, 0], [0, 4], ['0', 1], '0,1'])
    await api(a, 'POST', `/rooms/${multi.id}/answer`, { questionId: 'm1', selectedIndices }, 400);
  const correct = await Promise.all(
    Array.from({ length: 4 }, () =>
      api(a, 'POST', `/rooms/${multi.id}/answer`, { questionId: 'm1', selectedIndices: [1, 0] })
    )
  );
  assert(correct.every((result) => result.attempt.score === 700));
  assert.deepEqual(correct[0].feedback.correctIndices, [0, 1]);
  await api(a, 'POST', `/rooms/${multi.id}/next`, { questionId: 'm1' });
  const missing = await api(a, 'POST', `/rooms/${multi.id}/answer`, {
    questionId: 'm2',
    selectedIndices: [0],
  });
  assert.equal(missing.feedback.points, 0);
  await api(a, 'POST', `/rooms/${multi.id}/next`, { questionId: 'm2' });
  const extra = await api(a, 'POST', `/rooms/${multi.id}/answer`, {
    questionId: 'm3',
    selectedIndices: [0, 1, 2],
  });
  assert.equal(extra.feedback.points, 0);
  for (const id of ['m1', 'm2', 'm3']) {
    await api(b, 'POST', `/rooms/${multi.id}/answer`, { questionId: id, selectedIndices: [0, 1] });
    await api(b, 'POST', `/rooms/${multi.id}/next`, { questionId: id });
  }
  const multiResult = await api(a, 'GET', `/rooms/${multi.id}/results`);
  assert.equal(multiResult.selected.score, 700);
  assert.deepEqual(multiResult.review[0].answer.selectedIndices, [1, 0]);
  assert.deepEqual(multiResult.review[0].correctIndices, [0, 1]);
  const legacyId = new ObjectId();
  await mongo
    .db('ptitsocial_quiz')
    .collection('quizzes')
    .insertOne({
      _id: legacyId,
      ownerId: host._id,
      title: 'Legacy ' + tag,
      status: 'ready',
      visibility: 'private',
      deletedAt: null,
      questions: [question('legacy')],
    });
  const legacy = (await api(host, 'POST', '/rooms', { quizId: legacyId.toString() }, 201)).room;
  await api(a, 'POST', '/rooms/join', { code: legacy.code });
  await api(host, 'POST', `/rooms/${legacy.id}/start`, {});
  assert.equal((await api(a, 'GET', `/rooms/${legacy.id}`)).question.selectionMode, 'single');
  assert.equal(
    (await api(a, 'POST', `/rooms/${legacy.id}/answer`, { questionId: 'legacy', selectedIndex: 3 }))
      .feedback.correct,
    true
  );
  console.log(
    'PASS multiple-answer exact scoring, missing/extra selection, invalid payloads, duplicate submission, privacy, review and legacy documents'
  );
  const leaveRoom = (
    await api(
      host,
      'POST',
      '/rooms',
      { quizId: multiQuiz._id, maxPlayers: 1, speedBonus: false },
      201
    )
  ).room;
  await api(a, 'POST', '/rooms/join', { code: leaveRoom.code });
  await api(host, 'POST', `/rooms/${leaveRoom.id}/leave`, {}, 403);
  await api(a, 'POST', `/rooms/${leaveRoom.id}/leave`, {});
  assert.equal((await api(host, 'GET', `/rooms/${leaveRoom.id}`)).players.length, 0);
  await api(b, 'POST', '/rooms/join', { code: leaveRoom.code }); // seat freed
  await api(b, 'POST', `/rooms/${leaveRoom.id}/leave`, {});
  await api(a, 'POST', '/rooms/join', { code: leaveRoom.code }); // may rejoin before start
  await api(host, 'POST', `/rooms/${leaveRoom.id}/start`, {});
  await api(a, 'POST', `/rooms/${leaveRoom.id}/answer`, {
    questionId: 'm1',
    selectedIndices: [0, 1],
  });
  await api(a, 'POST', `/rooms/${leaveRoom.id}/next`, { questionId: 'm1' });
  await api(a, 'POST', `/rooms/${leaveRoom.id}/leave`, {});
  const leftState = await api(a, 'GET', `/rooms/${leaveRoom.id}`);
  assert.equal(leftState.room.status, 'finished');
  assert.equal(leftState.room.finishReason, 'all_left');
  assert.equal(leftState.attempt.score, 700);
  assert(leftState.attempt.leftAt);
  await api(a, 'POST', '/rooms/join', { code: leaveRoom.code }, 409);
  await api(
    a,
    'POST',
    `/rooms/${leaveRoom.id}/answer`,
    { questionId: 'm2', selectedIndices: [0, 1] },
    409
  );
  await api(a, 'POST', `/rooms/${leaveRoom.id}/next`, { questionId: 'm2' }, 409);
  assert.equal((await api(a, 'GET', `/rooms/${leaveRoom.id}/results`)).selected.score, 700);
  const mixedRoom = (
    await api(host, 'POST', '/rooms', { quizId: multiQuiz._id, speedBonus: false }, 201)
  ).room;
  for (const user of [a, b]) await api(user, 'POST', '/rooms/join', { code: mixedRoom.code });
  await api(host, 'POST', `/rooms/${mixedRoom.id}/start`, {});
  await api(a, 'POST', `/rooms/${mixedRoom.id}/leave`, {});
  assert.equal((await api(b, 'GET', `/rooms/${mixedRoom.id}`)).room.status, 'running');
  assert.equal((await api(a, 'GET', `/rooms/${mixedRoom.id}/results`)).selected.left, true);
  for (const id of ['m1', 'm2', 'm3']) {
    await api(b, 'POST', `/rooms/${mixedRoom.id}/answer`, {
      questionId: id,
      selectedIndices: [0, 1],
    });
    await api(b, 'POST', `/rooms/${mixedRoom.id}/next`, { questionId: id });
  }
  assert.equal((await api(host, 'GET', `/rooms/${mixedRoom.id}`)).room.status, 'finished');
  const ownHistory = await api(a, 'GET', '/history');
  assert(ownHistory.rooms.find((room) => room.id === leaveRoom.id).left);
  console.log(
    'PASS leave lobby frees seat, rejoin before start, host permissions, withdrawal keeps score, blocks answers and does not stall remaining players'
  );
  const longQuiz = (
    await api(
      host,
      'POST',
      '/quizzes',
      {
        ...body,
        title: 'Long ' + tag,
        questions: Array.from({ length: 100 }, (_, index) => question('long-' + index, 180)),
      },
      201
    )
  ).quiz;
  const longRoom = (await api(host, 'POST', '/rooms', { quizId: longQuiz._id }, 201)).room;
  assert.equal(longRoom.timeLimitMinutes, 365);
  await api(a, 'POST', '/rooms/join', { code: longRoom.code });
  const startedLong = await api(host, 'POST', `/rooms/${longRoom.id}/start`, {});
  assert.equal(
    new Date(startedLong.room.expiresAt) - new Date(startedLong.room.startedAt),
    365 * 60 * 1000
  );
  assert.equal(startedLong.room.timeLimitMinutes, 365);
  await api(host, 'POST', `/rooms/${longRoom.id}/end`, {});
  console.log(
    'PASS 100-question room gets 365 minutes and expiry is persisted from server start time'
  );
}
async function cleanup() {
  sockets.forEach((socket) => socket.close());
  if (!mongo) return;
  const ids = users.map((user) => new ObjectId(user._id)),
    strings = users.map((user) => user._id);
  const db = mongo.db('ptitsocial_quiz');
  const rooms = await db
    .collection('quizrooms')
    .find({ 'host.id': { $in: strings } })
    .project({ _id: 1 })
    .toArray();
  await db
    .collection('quizattempts')
    .deleteMany({ roomId: { $in: rooms.map((room) => room._id) } });
  await db.collection('quizrooms').deleteMany({ 'host.id': { $in: strings } });
  await db.collection('quizzes').deleteMany({ ownerId: { $in: strings } });
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
    console.error(error);
    process.exitCode = 1;
  })
  .finally(cleanup);
