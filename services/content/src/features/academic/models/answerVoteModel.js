const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  answer: { type: mongoose.Schema.Types.ObjectId, ref: 'Answer', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});
schema.index({ answer: 1, user: 1 }, { unique: true });
module.exports = mongoose.model('AnswerVote', schema);
