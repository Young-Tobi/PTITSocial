const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    answer: { type: mongoose.Schema.Types.ObjectId, ref: 'Answer', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 1000 },
    notificationPending: { type: Boolean, select: false },
  },
  { timestamps: true }
);
schema.index({ answer: 1, createdAt: 1 });
schema.index(
  { notificationPending: 1 },
  { partialFilterExpression: { notificationPending: true } }
);
module.exports = mongoose.model('AnswerComment', schema);
