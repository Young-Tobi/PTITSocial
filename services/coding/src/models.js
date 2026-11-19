const mongoose = require('mongoose');
const testSchema = new mongoose.Schema({ input: String, output: String }, { _id: false });
const problemSchema = new mongoose.Schema(
  {
    slug: { type: String, unique: true },
    title: String,
    description: String,
    inputFormat: String,
    outputFormat: String,
    constraints: String,
    difficulty: { type: String, enum: ['easy', 'medium'] },
    starterCode: String,
    samples: [testSchema],
    tests: [testSchema],
    timeLimit: { type: Number, default: 2 },
    memoryLimit: { type: Number, default: 262144 },
  },
  { timestamps: true }
);
const playerSchema = new mongoose.Schema(
  {
    userId: String,
    name: String,
    photo: String,
    leftAt: Date,
    scores: [{ problemId: String, passed: Number, total: Number, bestAt: Date, _id: false }],
  },
  { _id: false }
);
const roomSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    title: String,
    hostId: String,
    hostName: String,
    hostPhoto: String,
    version: { type: Number, default: 2 },
    legacy: { type: Boolean, default: false },
    visibility: { type: String, enum: ['public', 'private'], default: 'public', index: true },
    blockedIds: [String],
    durationMinutes: Number,
    maxPlayers: Number,
    players: [playerSchema],
    status: {
      type: String,
      enum: ['waiting', 'running', 'finished'],
      default: 'waiting',
      index: true,
    },
    // Ordered private snapshots selected from the server's problem bank.
    problems: { type: [mongoose.Schema.Types.Mixed], default: [] },
    startedAt: Date,
    endsAt: Date,
    expiresAt: Date,
    finishReason: String,
  },
  { timestamps: true }
);
const submissionSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, index: true },
    userId: String,
    problemId: String,
    requestId: String,
    language: { type: String, enum: ['c', 'cpp', 'java', 'python'], default: 'cpp' },
    code: String,
    mode: { type: String, enum: ['run', 'submit'] },
    status: {
      type: String,
      enum: ['queued', 'judging', 'done', 'error'],
      default: 'queued',
      index: true,
    },
    receivedAt: Date,
    passed: Number,
    total: Number,
    verdict: String,
    compileOutput: String,
    error: String,
    results: [
      {
        index: Number,
        passed: Boolean,
        status: String,
        time: String,
        memory: Number,
        output: String,
        stderr: String,
      },
    ],
    judgedAt: Date,
  },
  { timestamps: true }
);
submissionSchema.index({ roomId: 1, userId: 1, requestId: 1 }, { unique: true });
module.exports = {
  Problem: mongoose.model('CodingProblem', problemSchema),
  Room: mongoose.model('CodingRoom', roomSchema),
  Submission: mongoose.model('CodingSubmission', submissionSchema),
};
