const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, minlength: 10, maxlength: 20000 },
    notificationPending: { type: Boolean, select: false },
  },
  { timestamps: true }
);
schema.index({ question: 1, createdAt: 1 });
schema.index(
  { notificationPending: 1 },
  { partialFilterExpression: { notificationPending: true } }
);
module.exports = mongoose.model('Answer', schema);
