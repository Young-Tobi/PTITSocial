const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'FocusRoom', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['host', 'member'], default: 'member' },
    active: { type: Boolean, default: true, index: true },
    micEnabled: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
    leftAt: Date,
    kickedAt: Date,
  },
  { timestamps: true }
);
schema.index({ room: 1, user: 1 }, { unique: true });
module.exports = mongoose.model('FocusRoomParticipant', schema);
