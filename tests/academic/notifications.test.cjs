const { test } = require('node:test');
const assert = require('node:assert/strict');
const Answer = require('../../services/content/src/features/academic/models/answerModel');
const Comment = require('../../services/content/src/features/academic/models/answerCommentModel');
const Question = require('../../services/content/src/features/academic/models/questionModel');
const User = require('../../services/content/src/models/userModel');
const Notification = require('../../services/content/src/features/academic/utils/notificationClient');
const {
  notify,
  retryPending,
} = require('../../services/content/src/features/academic/utils/academicNotifications');

test('a temporary messaging failure preserves the pending answer and retries after recovery', async (t) => {
  const answer = { _id: 'answer', id: 'answer', question: 'question', author: 'author' };
  let pending = true;
  t.mock.method(Question, 'findById', async () => ({
    id: 'question',
    title: 'Question',
    author: 'owner',
  }));
  t.mock.method(User, 'findById', async () => ({ _id: 'author', first_name: 'Student' }));
  t.mock.method(Answer, 'updateOne', async (filter, update, options) => {
    assert.equal(filter._id, 'answer');
    assert.deepEqual(update, { $unset: { notificationPending: 1 } });
    assert.equal(options.timestamps, false);
    pending = false;
  });
  t.mock.method(Answer, 'find', () => ({
    sort: () => ({ limit: async () => (pending ? [answer] : []) }),
  }));
  t.mock.method(Comment, 'find', () => ({ sort: () => ({ limit: async () => [] }) }));
  const dispatch = t.mock.method(Notification.prototype, 'dispatch', async () => {
    throw new Error('Messaging unavailable');
  });
  const warn = t.mock.method(console, 'warn', () => {});
  await notify('answer', answer);
  assert.equal(pending, true);
  assert.equal(warn.mock.calls.length, 1);
  dispatch.mock.mockImplementation(async function (action) {
    assert.equal(action, 'sendAcademicAnswer');
    assert.equal(this.payload.recipient._id, 'owner');
    assert.equal(this.payload.sourceId, 'answer');
  });
  await retryPending();
  assert.equal(pending, false);
  assert.equal(dispatch.mock.calls.length, 2);
  await retryPending();
  assert.equal(dispatch.mock.calls.length, 2);
});

test('discussion notifications exclude their author and deduplicate recipients', async (t) => {
  t.mock.method(Answer, 'findById', async () => ({ question: 'question', author: 'owner' }));
  t.mock.method(Question, 'findById', async () => ({
    id: 'question',
    title: 'Question',
    author: 'owner',
  }));
  t.mock.method(User, 'findById', async (id) => ({ _id: id, first_name: 'Student' }));
  t.mock.method(Comment, 'updateOne', async () => {});
  const sent = [];
  t.mock.method(Notification.prototype, 'dispatch', async function () {
    sent.push(this.payload.recipient._id);
  });
  await notify('comment', { _id: 'comment', id: 'comment', answer: 'answer', author: 'other' });
  assert.deepEqual(sent, ['owner']);
  await notify('comment', {
    _id: 'own-comment',
    id: 'own-comment',
    answer: 'answer',
    author: 'owner',
  });
  assert.deepEqual(sent, ['owner']);
});
