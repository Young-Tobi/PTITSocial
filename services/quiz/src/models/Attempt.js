const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userId: { type: String, required: true },
    name: String,
    photo: String,
    removed: { type: Boolean, default: false },
    leftAt: { type: Date, default: null },
    phase: {
      type: String,
      enum: ['waiting', 'answering', 'feedback', 'completed'],
      default: 'waiting',
    },
    cursor: { type: Number, default: 0 },
    questionStartedAt: Date,
    optionOrders: [[Number]],
    answers: [
      {
        questionId: String,
        selectedIndex: { type: Number, default: null },
        selectedIndices: { type: [Number], default: undefined },
        correct: Boolean,
        points: Number,
        speedPoints: Number,
        elapsedMs: Number,
        timedOut: Boolean,
        submittedAt: Date,
      },
    ],
    score: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    completedAt: Date,
  },
  { timestamps: true }
);

schema.index({ roomId: 1, userId: 1 }, { unique: true });
module.exports = mongoose.model('QuizAttempt', schema);
