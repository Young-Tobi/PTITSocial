const mongoose = require('mongoose');

// Adapter to the base notification inbox. Public fields and type stay compatible
// with the existing list, seen endpoint and icons; no base schema edits.
const schema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['comment'], default: 'comment' },
    click: { type: String, required: true },
    content: { type: String, required: true, maxlength: 400 },
    seen: { type: String, enum: ['unseen', 'seen'], default: 'unseen' },
    academicKind: { type: String, enum: ['answer', 'comment'], required: true },
    academicEventKey: { type: String, required: true, select: false },
  },
  { timestamps: true, collection: 'notifications' }
);
schema.index({ academicEventKey: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model('AcademicNotification', schema);
