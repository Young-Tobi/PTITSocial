const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  roomSettings,
  leaderboard,
  canImprove,
  pointsFor,
  solvedAll,
} = require('../services/coding/src/rules');
const ids = ['a'.repeat(24), 'b'.repeat(24)];
test('language profiles whitelist compilers and apply bounded runtime budgets', () => {
  const { getLanguage, limitsFor } = require('../services/coding/src/languages');
  assert.equal(getLanguage().id, 54);
  assert.equal(getLanguage('c').id, 50);
  assert.equal(getLanguage('python').id, 71);
  assert.equal(getLanguage('java').id, 62);
  for (const invalid of ['javascript', 'constructor', '__proto__', 1, {}, []])
    assert.throws(() => getLanguage(invalid));
  assert.equal(limitsFor('cpp', { timeLimit: 2, memoryLimit: 262144 }).cpu_time_limit, 2);
  assert.equal(limitsFor('python', { timeLimit: 2, memoryLimit: 262144 }).cpu_time_limit, 6);
  assert.equal(limitsFor('java', { timeLimit: 2, memoryLimit: 262144 }).memory_limit, 2097152);
  assert.equal(limitsFor('python', { timeLimit: 100, memoryLimit: 262144 }).wall_time_limit, 20);
});
test('room settings require a unique ordered selection, visibility and bounded integer duration/capacity', () => {
  const body = { title: ' Test ', problemIds: ids };
  assert.deepEqual(roomSettings(body), {
    title: 'Test',
    durationMinutes: 45,
    maxPlayers: 8,
    visibility: 'public',
    problemIds: ids,
  });
  for (const change of [
    { title: '' },
    { problemIds: [] },
    { problemIds: [ids[0], ids[0].toUpperCase()] },
    { problemIds: ['bad'] },
    { problemIds: null },
    { maxPlayers: 0 },
    { maxPlayers: 31 },
    { maxPlayers: 2.5 },
    { durationMinutes: 0 },
    { durationMinutes: 181 },
    { durationMinutes: 5.5 },
    { visibility: 'secret' },
  ])
    assert.throws(() => roomSettings({ ...body, ...change }));
  assert.equal(
    roomSettings({ ...body, maxPlayers: 30, durationMinutes: 180, visibility: 'private' })
      .maxPlayers,
    30
  );
});
test('each problem is worth 100 points despite different test counts; ties use time of achieving total', () => {
  const startedAt = new Date('2026-01-01T00:00:00Z');
  const score = (id, passed, total, ms) => ({
    problemId: id,
    passed,
    total,
    bestAt: new Date(+startedAt + ms),
  });
  const room = {
    startedAt,
    problems: [
      { _id: ids[0], tests: [1, 2, 3, 4] },
      { _id: ids[1], tests: [1, 2] },
    ],
    players: [
      { userId: 'a', scores: [score(ids[0], 4, 4, 1000), score(ids[1], 1, 2, 5000)] },
      {
        userId: 'b',
        scores: [score(ids[0], 4, 4, 3000), score(ids[1], 1, 2, 4000)],
        leftAt: new Date(),
      },
      { userId: 'c', scores: [score(ids[0], 4, 4, 6000), score(ids[1], 2, 2, 9000)] },
      { userId: 'd', scores: [] },
    ],
  };
  const rows = leaderboard(room);
  assert.deepEqual(
    rows.map((row) => row.userId),
    ['c', 'b', 'a', 'd']
  );
  assert.deepEqual(
    rows.map((row) => row.points),
    [200, 150, 150, 0]
  );
  assert.equal(rows[1].left, true);
  assert.equal(rows[1].elapsedSeconds, 4);
  assert.equal(rows[3].elapsedSeconds, null);
  assert.equal(solvedAll(room, room.players[0]), false);
  assert.equal(solvedAll(room, room.players[2]), true);
  assert.equal(pointsFor(1, 3), 33.33);
  assert.equal(pointsFor(0, 0), 0);
});
test('duplicate, later or worse attempts cannot add score or replace the best', () => {
  const score = { passed: 2, bestAt: new Date(2000) };
  assert.equal(canImprove(score, 1, new Date(1000)), false);
  assert.equal(canImprove(score, 2, new Date(3000)), false);
  assert.equal(canImprove(score, 2, new Date(1000)), true);
  assert.equal(canImprove(score, 4, new Date(4000)), true);
  assert.equal(canImprove(null, 0, new Date()), false);
  assert.equal(canImprove(null, 1, new Date()), true);
});
