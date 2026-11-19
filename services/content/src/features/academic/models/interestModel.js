const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    subjects: { type: [String], default: [] },
    tags: { type: [String], default: [] },
  },
  { timestamps: true, collection: 'academic_interests' }
);
module.exports = mongoose.model('AcademicInterest', schema);
