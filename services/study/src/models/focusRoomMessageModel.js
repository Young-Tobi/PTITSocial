const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'FocusRoom', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);
schema.index({ room: 1, createdAt: -1 });
module.exports = mongoose.model('FocusRoomMessage', schema);
