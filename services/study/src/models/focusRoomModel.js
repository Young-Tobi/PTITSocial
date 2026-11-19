const mongoose = require('mongoose');

const pomodoroSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ['focus', 'break'], default: 'focus' },
    status: { type: String, enum: ['idle', 'running', 'paused', 'ended'], default: 'idle' },
    focusMinutes: { type: Number, min: 1, max: 120, default: 25 },
    breakMinutes: { type: Number, min: 1, max: 60, default: 5 },
    endsAt: Date,
    remainingSeconds: { type: Number, min: 0, default: 1500 },
  },
  { _id: false }
);

const focusRoomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    topic: { type: String, trim: true, maxlength: 80, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    privacy: { type: String, enum: ['public', 'private'], default: 'public', index: true },
    inviteCode: { type: String, select: false, unique: true, sparse: true, index: true },
    accessPasswordHash: { type: String, select: false },
    maxMembers: { type: Number, min: 2, max: 20, default: 8 },
    memberCount: { type: Number, min: 0, default: 0 },
    allowMicrophones: { type: Boolean, default: true },
    theme: {
      type: String,
      enum: ['night-library', 'coffee-shop', 'rain-window', 'green-nature'],
      default: 'night-library',
    },
    active: { type: Boolean, default: true, index: true },
    endedAt: Date,
    pomodoro: { type: pomodoroSchema, default: () => ({}) },
  },
  { timestamps: true }
);

focusRoomSchema.index({ name: 'text', topic: 'text', description: 'text' });
module.exports = mongoose.model('FocusRoom', focusRoomSchema);
