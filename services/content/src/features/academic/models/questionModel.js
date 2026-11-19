const mongoose = require('mongoose');
const { subjects } = require('../utils/subjects');
const schema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, minlength: 10, maxlength: 200 },
    body: { type: String, required: true, minlength: 20, maxlength: 20000 },
    subject: { type: String, enum: subjects.map((s) => s.id), required: true },
    tags: [String],
    acceptedAnswer: { type: mongoose.Schema.Types.ObjectId, ref: 'Answer', default: null },
  },
  { timestamps: true }
);
schema.index({ title: 'text', body: 'text' }, { default_language: 'none' });
schema.index({ createdAt: -1, _id: -1 });
schema.index({ subject: 1, createdAt: -1 });
schema.index({ tags: 1, createdAt: -1 });
schema.index({ acceptedAnswer: 1, createdAt: -1 });
module.exports = mongoose.model('Question', schema);
