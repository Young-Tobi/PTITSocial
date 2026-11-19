const mongoose = require('mongoose');
const { questionSchema } = require('./Quiz');

const schema = new mongoose.Schema(
  {
    quizId: { type: mongoose.Schema.Types.ObjectId, required: true },
    title: String,
    subject: String,
    host: { id: String, name: String, photo: String },
    code: { type: String, unique: true, required: true },
    status: {
      type: String,
      enum: ['waiting', 'running', 'finished'],
      default: 'waiting',
      index: true,
    },
    finishReason: String,
    questions: [questionSchema],
    settings: {
      maxPlayers: { type: Number, default: 30 },
      shuffleOptions: { type: Boolean, default: true },
      speedBonus: { type: Boolean, default: true },
    },
    startedAt: Date,
    finishedAt: Date,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('QuizRoom', schema);
