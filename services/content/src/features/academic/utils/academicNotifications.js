const Answer = require('../models/answerModel');
const Comment = require('../models/answerCommentModel');
const Question = require('../models/questionModel');
const User = require('../../../models/userModel');
const Notification = require('./notificationClient');

async function deliver(kind, entry) {
  const answer = kind === 'answer' ? entry : await Answer.findById(entry.answer);
  const question = answer && (await Question.findById(answer.question));
  const sender = await User.findById(entry.author);
  if (question && sender) {
    const recipients = new Set([String(question.author)]);
    if (kind === 'comment') recipients.add(String(answer.author));
    recipients.delete(String(entry.author));
    for (const recipient of recipients) {
      await new Notification({
        sender,
        recipient: { _id: recipient },
        questionId: question.id,
        questionTitle: question.title,
        sourceId: entry.id,
      })[kind === 'answer' ? 'sendAcademicAnswer' : 'sendAcademicComment']();
    }
  }
  const Model = kind === 'answer' ? Answer : Comment;
  await Model.updateOne(
    { _id: entry._id },
    { $unset: { notificationPending: 1 } },
    { timestamps: false }
  );
}

async function notify(kind, entry) {
  try {
    await deliver(kind, entry);
  } catch (error) {
    // The answer/comment is already saved. Keep its pending flag for retry instead
    // of returning an error that would cause the user to submit the content again.
    console.warn(`Academic notification pending (${kind} ${entry.id}): ${error.message}`);
  }
}

let running = false;
async function retryPending() {
  if (running) return;
  running = true;
  try {
    for (const [kind, Model] of [
      ['answer', Answer],
      ['comment', Comment],
    ]) {
      const entries = await Model.find({ notificationPending: true }).sort({ _id: 1 }).limit(100);
      for (const entry of entries) await notify(kind, entry);
    }
  } finally {
    running = false;
  }
}

function startRetries() {
  const retry = () =>
    retryPending().catch((error) => console.warn('Academic notification retry:', error.message));
  retry();
  const timer = setInterval(retry, 30000);
  timer.unref();
  return timer;
}

module.exports = { notify, retryPending, startRetries };
