const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    address: { type: String, required: true, trim: true, maxlength: 250 },
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (value) =>
            value.length === 2 && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90,
          message: 'Coordinates must be [longitude, latitude]',
        },
      },
    },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    image: { type: String, trim: true, default: '' },
    type: {
      type: String,
      enum: ['library', 'self-study', 'group-space', 'cafe'],
      required: true,
      index: true,
    },
    quietLevel: { type: Number, min: 1, max: 5, default: 3 },
    wifi: { type: Boolean, default: false },
    powerOutlets: { type: Boolean, default: false },
    suitableFor: { type: [String], enum: ['individual', 'group'], default: ['individual'] },
    averageRating: { type: Number, min: 0, max: 5, default: 0 },
    reviewCount: { type: Number, min: 0, default: 0 },
    externalSource: { type: String, trim: true, index: true },
    externalId: { type: String, trim: true },
    sourceUrl: { type: String, trim: true, default: '' },
    sourceUpdatedAt: { type: Date },
    isSample: { type: Boolean, default: false, index: true },
    verified: { type: Boolean, default: false },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);
schema.index({ coordinates: '2dsphere' });
schema.index({ name: 'text', address: 'text', description: 'text' });
schema.index(
  { externalSource: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalSource: { $type: 'string' } } }
);
module.exports = mongoose.model('StudyLocation', schema);
