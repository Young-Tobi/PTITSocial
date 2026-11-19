const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');

const questionSchema = new mongoose.Schema(
  {
    id: { type: String, default: randomUUID },
    text: { type: String, default: '' },
    options: { type: [String], default: () => ['', '', '', ''] },
    correctIndex: { type: Number, default: 0 },
    correctIndices: { type: [Number], default: undefined },
    timeLimit: { type: Number, default: 20 },
    explanation: { type: String, default: '' },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true, index: true },
    ownerName: String,
    title: { type: String, required: true },
    description: { type: String, default: '' },
    subject: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'ready'], default: 'draft' },
    visibility: { type: String, enum: ['private', 'public'], default: 'private' },
    questions: [questionSchema],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Quiz', schema);
module.exports.questionSchema = questionSchema;
