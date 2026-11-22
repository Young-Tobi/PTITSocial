const mongoose = require('mongoose');
const { Schema } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, required: true });
const fileFields = {
  originalName: String,
  format: String,
  mime: String,
  bytes: Number,
  storageKey: { type: String, select: false },
};
const schema = new Schema(
  {
    author: ref('User'),
    title: String,
    description: String,
    subject: String,
    topic: String,
    keywords: [String],
    source: String,
    rightsConfirmedAt: Date,
    ...fileFields,
    additionalFiles: { type: [new Schema(fileFields, { _id: false })], default: undefined },
    status: { type: String, enum: ['published', 'hidden', 'deleted'], default: 'published' },
    moderationReason: String,
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: Date,
  },
  { timestamps: true }
);
schema.index(
  { title: 'text', description: 'text', keywords: 'text' },
  { default_language: 'none' }
);
schema.index({ status: 1, createdAt: -1, _id: -1 });
schema.index({ author: 1, createdAt: -1 });
schema.index({ subject: 1, topic: 1, status: 1, createdAt: -1 });
function interaction(name, collection) {
  const value = new Schema(
    { document: ref('StudyDocument'), user: ref('User') },
    { timestamps: true }
  );
  value.index({ document: 1, user: 1 }, { unique: true });
  value.index({ user: 1, createdAt: -1 });
  return mongoose.model(name, value, collection);
}
const comment = new Schema(
  { document: ref('StudyDocument'), author: ref('User'), body: String },
  { timestamps: true }
);
comment.index({ document: 1, createdAt: 1 });
const report = new Schema(
  {
    document: ref('StudyDocument'),
    reporter: ref('User'),
    reason: String,
    body: String,
    status: { type: String, enum: ['pending', 'dismissed', 'resolved'], default: 'pending' },
    resolution: String,
    handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    handledAt: Date,
  },
  { timestamps: true }
);
report.index(
  { document: 1, reporter: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);
report.index({ status: 1, createdAt: 1 });
const cleanup = new Schema({
  key: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now },
});
module.exports = {
  Document: mongoose.model('StudyDocument', schema, 'study_documents'),
  Favorite: interaction('DocumentFavorite', 'document_favorites'),
  Vote: interaction('DocumentVote', 'document_votes'),
  Comment: mongoose.model('DocumentComment', comment, 'document_comments'),
  Report: mongoose.model('DocumentReport', report, 'document_reports'),
  Cleanup: mongoose.model('DocumentCleanup', cleanup, 'document_cleanup'),
};
