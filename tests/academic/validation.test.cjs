const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tags, interests } = require('../../services/content/src/features/academic/utils/subjects');
const {
  filters,
  question,
  pagination,
} = require('../../services/content/src/features/academic/utils/academicValidation');
test('academic tags normalize and reject operators and oversized input', () => {
  assert.deepEqual(tags([' MongoDB ', 'mongodb', 'C++']), ['mongodb', 'c++']);
  for (const input of [null, {}, ['$where'], ['x'], Array(6).fill('web')])
    assert.throws(() => tags(input));
  assert.throws(() => interests({ subjects: ['invalid'], tags: [] }));
});
test('academic dates use Vietnam day boundaries and reject invalid calendar dates', () => {
  const result = filters({
    from: '2026-11-14',
    to: '2026-11-14',
    status: 'unresolved',
    tags: 'mongodb,node.js',
  });
  assert.equal(result.createdAt.$gte.toISOString(), '2026-11-13T17:00:00.000Z');
  assert.equal(result.createdAt.$lt.toISOString(), '2026-11-14T17:00:00.000Z');
  assert.equal(result.acceptedAnswer, null);
  for (const query of [
    { from: '2026-02-30' },
    { from: '2026-11-15', to: '2026-11-14' },
    { q: {} },
    { tags: [] },
    { status: '$ne' },
  ])
    assert.throws(() => filters(query));
});
test('question preserves text whitespace and pagination is bounded', () => {
  const body = 'Question details:\n    First observation.\n    Second observation.';
  assert.equal(
    question({ title: 'MongoDB connection error', body, subject: 'web', tags: '["mongodb"]' }).body,
    body
  );
  assert.throws(() => question({ title: 'short', body, subject: 'web' }));
  assert.throws(() => pagination({ limit: '51' }));
  assert.throws(() => pagination({ page: '0' }));
  assert.deepEqual(pagination({}), { page: 1, limit: 20 });
});
