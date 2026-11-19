const test = require('node:test');
const assert = require('node:assert/strict');
const { schedule, validateCards, serialize, Deck } = require('../services/learning/src/flashcards');
const now = new Date('2026-11-18T08:00:00Z');
const initial = { repetitions: 0, intervalDays: 0, reviews: 0 };
test('spaced repetition: forgot resets streak, hard grows slowly, remembered grows to one year maximum', () => {
  const first = schedule(initial, 'good', now);
  assert.equal(first.intervalDays, 1);
  const second = schedule(first, 'good', now);
  assert.equal(second.intervalDays, 3);
  const third = schedule(second, 'good', now);
  assert.equal(third.intervalDays, 7);
  assert.equal(schedule(third, 'good', now).intervalDays, 14);
  assert.equal(schedule(third, 'hard', now).intervalDays, 9);
  const again = schedule(third, 'again', now);
  assert.equal(again.repetitions, 0);
  assert.equal(again.dueAt.getTime() - now.getTime(), 600000);
  assert.equal(again.reviews, 4);
  assert.equal(schedule(again, 'good', now).intervalDays, 1);
  assert.equal(schedule({ ...third, intervalDays: 365 }, 'hard', now).intervalDays, 365);
  assert.equal(schedule({ ...third, intervalDays: 365 }, 'good', now).intervalDays, 365);
  assert.throws(() => schedule(initial, 'unknown', now), /Vui lòng chọn/);
});
test('cards reject empty, oversized and unstructured content', () => {
  assert.throws(() => validateCards([]));
  assert.throws(() => validateCards([{ front: '  ', back: 'Answer' }]));
  assert.throws(() => validateCards([{ front: 'a', back: 'x'.repeat(6001) }]));
  assert.throws(() => validateCards(Array(13).fill({ front: 'a', back: 'b' }), true));
  assert.deepEqual(validateCards([{ front: ' Q ', back: ' A ', user: 'forged' }]), [
    { front: 'Q', back: 'A' },
  ]);
});
test('summary counts due and today in Vietnam, excludes private owner and idempotency history', () => {
  const deck = new Deck({
    user: '000000000000000000000001',
    title: 'Python',
    cards: [
      { front: 'Q1', back: 'A1', dueAt: now },
      {
        front: 'Q2',
        back: 'A2',
        dueAt: new Date(now.getTime() + 86400000),
        repetitions: 1,
        lastReviewedAt: new Date('2026-11-17T18:00:00Z'),
      },
    ],
    reviewLog: [{ requestId: 'review-1234567890' }],
  });
  const value = serialize(deck, now);
  assert.equal(value.due, 1);
  assert.equal(value.learned, 1);
  assert.equal(value.reviewedToday, 1);
  assert.equal(value.user, undefined);
  assert.equal(value.reviewLog, undefined);
});
