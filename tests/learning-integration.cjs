// Uses a loopback Gemini fixture and an isolated database. No real API key or AI claim.
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { MongoClient, ObjectId } = require('mongodb');
const tag = Date.now();
const database = `ptitsocial_learning_test_${tag}`;
const base = 'http://127.0.0.1:18104/api/v1/learning';
const users = [];
const providerContexts = [];
let child;
let fixture;
let client;

async function api(route, { method = 'GET', token, body, expected = 200 } = {}) {
  const response = await fetch(base + route, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  return data;
}
async function account(index, verified = true) {
  const email = `learning-${tag}-${index}@example.com`;
  const response = await fetch('http://localhost:8000/api/v1/users/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      first_name: 'Learning',
      last_name: 'Student',
      email,
      password: 'PtitDemo@2026',
      passwordConfirm: 'PtitDemo@2026',
      gender: 'male',
      birth_Year: 2003,
      birth_Month: 1,
      birth_Day: 15,
    }),
  });
  const data = await response.json();
  assert(response.ok, JSON.stringify(data));
  const user = { ...data.data.user, token: data.data.token, email };
  users.push(new ObjectId(user._id));
  if (verified)
    await client
      .db('ptitsocial_accounts')
      .collection('users')
      .updateOne({ _id: new ObjectId(user._id) }, { $set: { verified: true } });
  return user;
}
function vectors(text) {
  return [...(/python/i.test(text) ? [1, 0, 0.1] : [0, 1, 0.1]), ...Array(765).fill(0)];
}

async function main() {
  client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  fixture = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    res.setHeader('content-type', 'application/json');
    assert.equal(req.headers['x-goog-api-key'], 'fixture-key');
    assert.equal(req.headers.authorization, undefined);
    if (req.url.endsWith(':batchEmbedContents'))
      return res.end(
        JSON.stringify({
          embeddings: body.requests.map((item) => ({
            values: vectors(item.content.parts[0].text),
          })),
        })
      );
    assert(req.url.endsWith(':generateContent'));
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    const context = JSON.parse(body.contents[0].parts[0].text);
    providerContexts.push(context);
    if (context.mode === 'flashcards') {
      assert.deepEqual(body.generationConfig.responseJsonSchema.required, ['cards']);
      return res.end(
        JSON.stringify({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      cards: [
                        { front: 'Python là gì?', back: 'Một ngôn ngữ lập trình.' },
                        { front: 'Biến dùng để làm gì?', back: 'Lưu trữ dữ liệu.' },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        })
      );
    }
    if (context.question === 'kiểm tra hết hạn mức') {
      res.statusCode = 429;
      return res.end('{}');
    }
    if (context.question === 'câu hỏi chậm')
      await new Promise((resolve) => setTimeout(resolve, 250));
    const result = {
      answer: 'Đây là phản hồi giả lập phục vụ kiểm thử.',
      roadmap: ['chat', 'guide'].includes(context.mode)
        ? null
        : {
            title: 'Lộ trình Python kiểm thử',
            summary: 'Dành cho kiểm thử luồng lưu trữ.',
            milestones: [
              {
                title: 'Bước đầu',
                description: 'Tìm hiểu nền tảng Python.',
                week: 1,
                tasks: ['Chạy chương trình', 'Làm bài tập'],
                resourceIds: [context.resources[0].id],
              },
            ],
          },
    };
    res.end(
      JSON.stringify({
        candidates: [
          { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(result) }] } },
        ],
      })
    );
  });
  await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  child = spawn(process.execPath, ['src/server.js'], {
    cwd: path.resolve(__dirname, '../services/learning'),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: '18104',
      DATABASE: `mongodb://127.0.0.1:27017/${database}`,
      GEMINI_API_KEY: 'fixture-key',
      GEMINI_API_KEYS: '',
      GEMINI_TEST_URL: `http://127.0.0.1:${fixture.address().port}/v1beta`,
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (chunk) => {
    logs += chunk;
  });
  child.stderr.on('data', (chunk) => {
    logs += chunk;
  });
  let ready = false;
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch('http://127.0.0.1:18104/health')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert(ready, logs);
  const first = await account(1);
  const second = await account(2);
  const unverified = await account(3, false);
  await api('/status', { expected: 401 });
  await api('/status', { token: unverified.token, expected: 403 });
  const status = await api('/status', { token: first.token });
  assert.equal(status.configured, true);
  assert(!JSON.stringify(status).includes('fixture-key'));
  await api('/roadmaps', { expected: 401 });
  const library = (await api('/roadmaps', { token: first.token })).roadmaps;
  assert.deepEqual(
    library.map((item) => item.id),
    ['ai-engineer', 'cyber-security', 'machine-learning', 'python', 'sql', 'cpp']
  );
  for (const item of library) {
    const detail = await api(`/roadmaps/${item.id}`, { token: first.token });
    assert.equal(detail.roadmap.reference, `https://roadmap.sh/${item.id}`);
    assert(detail.roadmap.graph.nodes.length > 20);
    assert.equal(item.topicCount, detail.roadmap.stages.flatMap((stage) => stage.topics).length);
    assert.deepEqual(detail.progress, {});
    for (const stage of detail.roadmap.stages)
      for (const topic of stage.topics) {
        assert(topic.description && topic.sourceId && topic.resources.length);
        assert(topic.resources.every((resource) => /^https?:\/\//.test(resource.url)));
      }
  }
  const pythonTopics = (
    await api('/roadmaps/python', { token: first.token })
  ).roadmap.stages.flatMap((stage) => stage.topics);
  const firstTopicId = pythonTopics[0].id,
    secondTopicId = pythonTopics[1].id;
  await api(`/roadmaps/python/topics/${firstTopicId}`, {
    method: 'PATCH',
    token: first.token,
    body: { status: 'learning' },
  });
  await api(`/roadmaps/python/topics/${secondTopicId}`, {
    method: 'PATCH',
    token: first.token,
    body: { status: 'done' },
  });
  const savedRoadmap = await api('/roadmaps/python', { token: first.token });
  assert.equal(savedRoadmap.progress[firstTopicId], 'learning');
  assert.equal(savedRoadmap.progress[secondTopicId], 'done');
  assert.deepEqual((await api('/roadmaps/python', { token: second.token })).progress, {});
  const firstLibrary = (await api('/roadmaps', { token: first.token })).roadmaps;
  assert.equal(firstLibrary.find((item) => item.id === 'python').progress[secondTopicId], 'done');
  await api(`/roadmaps/python/topics/${firstTopicId}`, {
    method: 'PATCH',
    token: second.token,
    body: { status: 'skipped', user: first._id },
  });
  assert.equal(
    (await api('/roadmaps/python', { token: first.token })).progress[firstTopicId],
    'learning'
  );
  await api(`/roadmaps/python/topics/${firstTopicId}`, {
    method: 'PATCH',
    token: first.token,
    body: { status: 'not-started' },
  });
  assert.equal(
    (await api('/roadmaps/python', { token: first.token })).progress[firstTopicId],
    'not-started'
  );
  await api('/roadmaps/python/topics/not-real', {
    method: 'PATCH',
    token: first.token,
    body: { status: 'done' },
    expected: 404,
  });
  await api(`/roadmaps/python/topics/${firstTopicId}`, {
    method: 'PATCH',
    token: first.token,
    body: { status: 'invalid' },
    expected: 400,
  });
  await api('/roadmaps/not-real', { token: first.token, expected: 404 });
  await client
    .db(database)
    .collection('roadmapprogresses')
    .updateOne(
      { user: new ObjectId(first._id), roadmap: 'python' },
      { $set: { 'topics.s1-t1': 'done' } }
    );
  assert.equal(
    (await api('/roadmaps/python', { token: first.token })).progress['s1-t1'],
    undefined
  );

  assert.equal(
    await client.db(database).collection('learningembeddingindexes').countDocuments(),
    0
  );
  console.log(
    'PASS six interactive roadmaps: canonical topics, private persisted progress, all states, validation and no AI requests'
  );
  const created = (
    await api('/sessions', {
      method: 'POST',
      token: first.token,
      body: {
        goal: 'Tôi muốn học Python',
        profile: { level: 'beginner', hoursPerWeek: 5, weeks: 8 },
      },
      expected: 201,
    })
  ).session;
  assert.equal(created.roadmap.milestones[0].tasks[0].done, false);
  assert(created.resources.some((source) => source.topic === 'python'));
  assert.equal((await api('/sessions', { token: second.token })).sessions.length, 0);
  await api(`/sessions/${created._id}`, { token: second.token, expected: 404 });
  await api(`/sessions/${created._id}/messages`, {
    method: 'POST',
    token: second.token,
    body: { content: 'Đọc lộ trình người khác' },
    expected: 404,
  });
  const taskId = created.roadmap.milestones[0].tasks[0]._id;
  const done = (
    await api(`/sessions/${created._id}/tasks/${taskId}`, {
      method: 'PATCH',
      token: first.token,
      body: { done: true },
    })
  ).session;
  assert.equal(done.roadmap.milestones[0].tasks[0].done, true);
  await api(`/sessions/${created._id}/tasks/${taskId}`, {
    method: 'PATCH',
    token: second.token,
    body: { done: true },
    expected: 404,
  });
  const reply = (
    await api(`/sessions/${created._id}/messages`, {
      method: 'POST',
      token: first.token,
      body: { content: 'Giải thích bước đầu' },
    })
  ).session;
  assert.equal(reply.messages.length, 4);
  assert.equal(providerContexts.at(-1).currentAnswer, created.messages[1].content);
  assert.equal(reply.roadmap.milestones[0].tasks[0].done, true);
  const slow = api(`/sessions/${created._id}/messages`, {
    method: 'POST',
    token: first.token,
    body: { content: 'câu hỏi chậm' },
  });
  await new Promise((resolve) => setTimeout(resolve, 80));
  await api(`/sessions/${created._id}/messages`, {
    method: 'POST',
    token: first.token,
    body: { content: 'gửi đồng thời' },
    expected: 409,
  });
  await slow;
  await api('/sessions', {
    method: 'POST',
    token: second.token,
    body: {
      goal: 'Học AI',
      kind: 'course',
      profile: { level: 'beginner', hoursPerWeek: 5, weeks: 8 },
    },
    expected: 400,
  });
  const guide = (
    await api('/sessions', {
      method: 'POST',
      token: second.token,
      body: {
        goal: 'Tôi muốn học AI',
        kind: 'guide',
        profile: { level: 'beginner', hoursPerWeek: 5, weeks: 8 },
      },
      expected: 201,
    })
  ).session;
  assert.equal(guide.kind, 'guide');
  assert(guide.guide.includes('phản hồi giả lập'));
  assert(!guide.roadmap || !guide.roadmap.title);
  assert.equal(
    (await api(`/sessions/${guide._id}`, { token: second.token })).session.guide,
    guide.guide
  );
  await api(`/sessions/${guide._id}`, { token: first.token, expected: 404 });
  const guideReply = (
    await api(`/sessions/${guide._id}/messages`, {
      method: 'POST',
      token: second.token,
      body: { content: 'Giải thích thêm phần đầu của hướng dẫn' },
    })
  ).session;
  assert.equal(guideReply.guide, guide.guide);
  assert.equal(providerContexts.findLast((context) => context.kind === 'guide').guide, guide.guide);
  assert.equal(guideReply.messages.length, 4);
  const savedGuides = (await api('/sessions', { token: second.token })).sessions;
  assert.equal(savedGuides.find((item) => item._id === guide._id).kind, 'guide');
  console.log(
    'PASS Guide: separate generation mode, persisted content, private access, history and follow-up'
  );
  const botUser = await account(4);
  const botSession = (
    await api('/sessions', {
      method: 'POST',
      token: botUser.token,
      body: {
        goal: 'Học Python',
        kind: 'guide',
        profile: { level: 'beginner', hoursPerWeek: 5, weeks: 8 },
      },
      expected: 201,
    })
  ).session;
  const botReply = (
    await api(`/sessions/${botSession._id}/messages`, {
      method: 'POST',
      token: botUser.token,
      body: { content: 'Giải thích 1', channel: 'khe' },
    })
  ).session;
  assert.equal(botReply.messages.length, 2);
  assert.equal(botReply.assistantMessages.length, 2);
  assert.equal(providerContexts.at(-1).question, 'Giải thích 1');
  assert.equal(providerContexts.at(-1).currentAnswer, botSession.guide);
  assert.equal(
    providerContexts.findLast((context) => context.assistantName === 'Khế').history.length,
    0
  );
  const separateReply = (
    await api(`/sessions/${botSession._id}/messages`, {
      method: 'POST',
      token: botUser.token,
      body: { content: 'Hỏi tiếp ở dưới bài' },
    })
  ).session;
  assert.equal(separateReply.messages.length, 4);
  assert.equal(separateReply.assistantMessages.length, 2);
  assert.equal(providerContexts.at(-1).assistantName, 'Trợ lý học tập');
  assert.equal(providerContexts.at(-1).history.length, 2);
  await api(`/sessions/${botSession._id}`, { token: first.token, expected: 404 });
  await api(`/sessions/${botSession._id}/messages`, {
    method: 'POST',
    token: botUser.token,
    body: { content: 'Sai kênh', channel: 'unknown' },
    expected: 400,
  });
  assert.equal(
    (await api(`/sessions/${botSession._id}`, { token: botUser.token })).session.assistantMessages
      .length,
    2
  );
  console.log(
    'PASS Khế: separate persisted history, contextual identity, private access and channel validation'
  );
  const flashUser = await account(8);
  const ft = flashUser.token;
  await api('/flashcards', { expected: 401 });
  await api('/flashcards', { token: unverified.token, expected: 403 });
  await api('/flashcards', {
    method: 'POST',
    token: ft,
    body: { title: 'Empty', cards: [] },
    expected: 400,
  });
  let fd = (
    await api('/flashcards', {
      method: 'POST',
      token: ft,
      expected: 201,
      body: {
        title: 'Python cards',
        cards: [
          { front: 'Question 1', back: 'Answer 1' },
          { front: 'Question 2', back: 'Answer 2' },
        ],
        user: second._id,
      },
    })
  ).deck;
  const fid = fd._id;
  assert.equal(fd.due, 2);
  assert.equal(fd.version, 0);
  assert.equal(fd.user, undefined);
  assert.equal((await api('/flashcards', { token: second.token })).decks.length, 0);
  const summary = (await api('/flashcards', { token: ft })).decks[0];
  assert.equal(summary.cards, undefined);
  for (const method of ['GET', 'PUT', 'DELETE'])
    await api(`/flashcards/${fid}`, {
      token: second.token,
      method,
      body: method === 'GET' ? undefined : { version: 0 },
      expected: 404,
    });
  await api(`/flashcards/${fid}/reviews`, {
    token: second.token,
    method: 'POST',
    body: {},
    expected: 404,
  });
  await api('/flashcards/generate', {
    token: ft,
    method: 'POST',
    body: { guideId: created._id },
    expected: 404,
  });
  const reviewBody = {
    version: 0,
    requestId: 'flashcards-review-0001',
    cardId: fd.cards[0]._id,
    rating: 'good',
  };
  fd = (await api(`/flashcards/${fid}/reviews`, { token: ft, method: 'POST', body: reviewBody }))
    .deck;
  assert.equal(fd.due, 1);
  assert.equal(fd.cards[0].intervalDays, 1);
  assert.equal(fd.version, 1);
  assert.equal(fd.reviewedToday, 1);
  const repeated = await api(`/flashcards/${fid}/reviews`, {
    token: ft,
    method: 'POST',
    body: reviewBody,
  });
  assert.equal(repeated.repeated, true);
  assert.equal(repeated.deck.cards[0].reviews, 1);
  await api(`/flashcards/${fid}/reviews`, {
    token: ft,
    method: 'POST',
    body: { ...reviewBody, rating: 'again' },
    expected: 409,
  });
  await api(`/flashcards/${fid}/reviews`, {
    token: ft,
    method: 'POST',
    body: { ...reviewBody, requestId: 'flashcards-review-0002', version: 1 },
    expected: 409,
  });
  const concurrent = await Promise.all(
    [0, 1].map(async (i) => {
      const response = await fetch(`${base}/flashcards/${fid}/reviews`, {
        method: 'POST',
        headers: { authorization: `Bearer ${ft}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          version: 1,
          cardId: fd.cards[1]._id,
          rating: 'again',
          requestId: `flashcards-concurrent-${i}`,
        }),
      });
      return response.status;
    })
  );
  assert.deepEqual(concurrent.sort(), [200, 409]);
  fd = (await api(`/flashcards/${fid}`, { token: ft })).deck;
  assert.equal(fd.cards[1].reviews, 1);
  assert.equal(fd.due, 0);
  assert(new Date(fd.cards[1].dueAt) > new Date());
  await api(`/flashcards/${fid}`, {
    token: ft,
    method: 'PUT',
    body: { version: 0, title: 'stale', cards: fd.cards },
    expected: 409,
  });
  fd = (
    await api(`/flashcards/${fid}`, {
      token: ft,
      method: 'PUT',
      body: {
        version: fd.version,
        title: 'Edited',
        cards: fd.cards.map((card, i) => ({
          ...card,
          back: i === 1 ? 'Changed answer' : card.back,
        })),
      },
    })
  ).deck;
  assert.equal(fd.cards[0].reviews, 1);
  assert.equal(fd.cards[1].reviews, 0);
  assert.equal(fd.due, 1);
  const guideId = new ObjectId();
  await client
    .db(database)
    .collection('learningsessions')
    .insertOne({
      _id: guideId,
      user: new ObjectId(flashUser._id),
      kind: 'guide',
      goal: 'Python',
      guide: 'Python là ngôn ngữ lập trình. Biến lưu dữ liệu.',
      messages: [],
    });
  await api('/flashcards/generate', {
    token: second.token,
    method: 'POST',
    body: { guideId: String(guideId) },
    expected: 404,
  });
  const draft = await api('/flashcards/generate', {
    token: ft,
    method: 'POST',
    body: { guideId: String(guideId) },
  });
  assert.equal(draft.cards.length, 2);
  assert.equal(
    (await api('/flashcards', { token: ft })).decks.length,
    1,
    'AI draft is not saved before review'
  );
  const aiDeck = (
    await api('/flashcards', { token: ft, method: 'POST', expected: 201, body: draft })
  ).deck;
  assert.equal(aiDeck.sourceGuide, String(guideId));
  await api(`/flashcards/${fid}`, { token: ft, method: 'DELETE', body: { version: fd.version } });
  await api(`/flashcards/${fid}`, { token: ft, expected: 404 });
  console.log(
    'PASS flashcards: manual CRUD, private access, AI preview/save, due schedule, idempotent reviews, concurrent-tab protection and edited-card reset'
  );
  await api(`/sessions/${created._id}/messages`, {
    method: 'POST',
    token: first.token,
    body: { content: 'kiểm tra hết hạn mức' },
    expected: 429,
  });
  const persisted = (await api(`/sessions/${created._id}`, { token: first.token })).session;
  assert.equal(persisted.messages.length, 6);
  assert.equal(persisted.roadmap.milestones[0].tasks[0].done, true);
  assert.equal(
    await client.db(database).collection('learningembeddingindexes').countDocuments(),
    1
  );
  console.log(
    'PASS learning: authentication, verified users, private history, semantic index cache, generation, task progress, follow-up, concurrent send lock and API failures (fixture provider)'
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (child) child.kill();
    if (fixture) fixture.close();
    if (client) {
      assert(/^ptitsocial_learning_test_\d+$/.test(database));
      await client.db(database).dropDatabase();
      const accounts = client.db('ptitsocial_accounts');
      await accounts.collection('users').deleteMany({ _id: { $in: users } });
      await client.close();
    }
  });
