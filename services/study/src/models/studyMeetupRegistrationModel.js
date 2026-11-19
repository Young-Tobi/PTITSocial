const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    meetup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyMeetup',
      required: true,
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    message: { type: String, trim: true, maxlength: 300, default: '' },
    decidedAt: Date,
  },
  { timestamps: true }
);
schema.index({ meetup: 1, user: 1 }, { unique: true });
module.exports = mongoose.model('StudyMeetupRegistration', schema);
