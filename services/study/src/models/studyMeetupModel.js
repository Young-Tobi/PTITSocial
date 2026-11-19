const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    subject: { type: String, required: true, trim: true, maxlength: 100 },
    goal: { type: String, trim: true, maxlength: 500, default: '' },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyLocation',
      required: true,
      index: true,
    },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    maxParticipants: { type: Number, min: 2, max: 100, default: 6 },
    acceptedCount: { type: Number, min: 1, default: 1 },
    status: {
      type: String,
      enum: ['scheduled', 'cancelled', 'completed'],
      default: 'scheduled',
      index: true,
    },
  },
  { timestamps: true }
);
schema.index({ location: 1, startsAt: 1, status: 1 });
module.exports = mongoose.model('StudyMeetup', schema);
