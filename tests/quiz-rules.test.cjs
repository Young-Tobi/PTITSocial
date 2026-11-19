const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeQuiz,
  scoreAnswer,
  rankAttempts,
  shuffledOptions,
  roomDurationMinutes,
} = require('../services/quiz/src/domain/rules');
const { withRoomLock } = require('../services/quiz/src/domain/locks');
test('room duration covers long quizzes while keeping the 90-minute minimum', () => {
  assert.equal(roomDurationMinutes([{ timeLimit: 20 }]), 90);
  assert.equal(roomDurationMinutes(Array.from({ length: 100 }, () => ({ timeLimit: 180 }))), 365);
  assert.equal(roomDurationMinutes(Array.from({ length: 50 }, () => ({ timeLimit: 180 }))), 190);
});
const complete = () => ({
  title: 'Ôn tập',
  status: 'ready',
  questions: [
    { id: 'q1', text: '2 + 2?', options: ['1', '2', '3', '4'], correctIndex: 3, timeLimit: 20 },
  ],
});
test('draft allows unfinished content, ready validates every question and option', () => {
  assert.equal(
    normalizeQuiz({ ...complete(), status: 'draft', questions: [] }).questions.length,
    0
  );
  for (const modify of [
    (q) => (q.questions = []),
    (q) => (q.questions[0].text = ''),
    (q) => (q.questions[0].options[1] = '1'),
    (q) => (q.questions[0].correctIndex = 4),
    (q) => (q.questions[0].timeLimit = 0),
    (q) => q.questions.push({ ...q.questions[0] }),
  ]) {
    const quiz = complete();
    modify(quiz);
    assert.throws(() => normalizeQuiz(quiz));
  }
  assert.equal(normalizeQuiz(complete()).visibility, 'private');
});
test('server time controls deadline and speed bonus; exact deadline cannot score', () => {
  const q = complete().questions[0];
  assert.equal(scoreAnswer(q, 3, 0, 0).points, 1000);
  assert.equal(scoreAnswer(q, 3, 0, 10000).points, 850);
  assert.equal(scoreAnswer(q, 3, 0, 19999).points, 700);
  assert.equal(scoreAnswer(q, 3, 0, 20000).points, 0);
  assert.equal(scoreAnswer(q, 3, 0, 20000).timedOut, true);
  assert.equal(scoreAnswer(q, 2, 0, 0).points, 0);
  assert.equal(scoreAnswer(q, 3, 0, 0, false).points, 700);
});
test('multiple answers require exact set, reject duplicates and preserve old single-answer questions', () => {
  const q = { ...complete().questions[0], correctIndices: [0, 1] };
  assert.equal(scoreAnswer(q, [1, 0], 0, 0, false).points, 700);
  for (const selected of [[0], [1], [0, 1, 2], [0, 0], [0, 1, 1], [], [4], ['0', 1]])
    assert.equal(scoreAnswer(q, selected, 0, 0).points, 0);
  assert.equal(scoreAnswer(q, [0, 1], 0, 20000).points, 0);
  assert.equal(scoreAnswer(complete().questions[0], [3], 0, 0).points, 1000);
  const normalized = normalizeQuiz({ ...complete(), questions: [q] }).questions[0];
  assert.deepEqual(normalized.correctIndices, [0, 1]);
  for (const invalid of [[0, 0], [4], ['0'], [], null, '0,1'])
    assert.throws(() =>
      normalizeQuiz({ ...complete(), questions: [{ ...q, correctIndices: invalid }] })
    );
  assert.deepEqual(
    normalizeQuiz({ ...complete(), status: 'draft', questions: [{ ...q, correctIndices: [] }] })
      .questions[0].correctIndices,
    []
  );
});
test('ties share rank and option shuffle preserves stable answer IDs', () => {
  const attempts = [
    ['b', 100],
    ['a', 100],
    ['c', 0],
  ].map(([userId, score]) => ({ userId, score, answers: [] }));
  assert.deepEqual(
    rankAttempts(attempts).map((row) => row.rank),
    [1, 1, 3]
  );
  for (let i = 0; i < 40; i++) assert.deepEqual(shuffledOptions(true).sort(), [0, 1, 2, 3]);
});
test('room operations serialize concurrent requests and recover after rejection', async () => {
  let counter = 0;
  await Promise.all(
    Array.from({ length: 20 }, () =>
      withRoomLock('room', async () => {
        const before = counter;
        await new Promise((resolve) => setTimeout(resolve, 2));
        counter = before + 1;
      })
    )
  );
  assert.equal(counter, 20);
  await assert.rejects(
    withRoomLock('room', async () => {
      throw Error('expected');
    })
  );
  assert.equal(await withRoomLock('room', async () => 42), 42);
});
