const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyLocation',
      required: true,
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true }
);
schema.index({ location: 1, user: 1 }, { unique: true });
module.exports = mongoose.model('StudyLocationReview', schema);
