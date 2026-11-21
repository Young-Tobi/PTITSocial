const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { createHash, randomUUID } = require('node:crypto');
const AppError = require('@ptitsocial/service-kit/appError');
const asyncRoute = require('@ptitsocial/service-kit/catchAsync');
const { Document, Favorite, Vote, Comment, Report, Cleanup } = require('./models');
const catalog = require('./catalog');
const v = require('./validation');
const storage = require('./storage');
const router = express.Router();
const fields = 'first_name last_name username photo';
const oid = (value) => new mongoose.Types.ObjectId(v.id(value));
const success = (res, data, code = 200) => res.status(code).json({ status: 'success', data });
const moderator = (req) =>
  (process.env.DOCUMENT_MODERATOR_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .includes(req.user.id);
const requireModerator = (req, res, next) =>
  moderator(req) ? next() : next(new AppError('Bạn không có quyền quản lý kho tài liệu.', 403));
const same = (a, b) => String(a?._id || a) === String(b?._id || b);
async function get(req, includePrivate = false) {
  const doc = await Document.findById(oid(req.params.id));
  if (
    !doc ||
    doc.status === 'deleted' ||
    (doc.status !== 'published' &&
      !(includePrivate && (same(doc.author, req.user.id) || moderator(req))))
  )
    throw new AppError('Tài liệu không tồn tại hoặc không còn được chia sẻ.', 404);
  return doc;
}
const owned = (req, doc) => {
  if (!same(doc.author, req.user.id))
    throw new AppError('Bạn chỉ được quản lý tài liệu do mình đăng.', 403);
};
const counters = [
  {
    $lookup: {
      from: 'document_votes',
      localField: '_id',
      foreignField: 'document',
      as: 'votes',
      pipeline: [{ $project: { _id: 1 } }],
    },
  },
  { $addFields: { helpfulCount: { $size: '$votes' } } },
  { $project: { votes: 0, storageKey: 0 } },
];
async function list(req, res, scope) {
  const { page, limit } = v.page(req.query);
  const match = { ...v.filters(req.query), status: 'published' };
  if (scope === 'mine') {
    match.author = oid(req.user.id);
    match.status = { $ne: 'deleted' };
  }
  const stages = [{ $match: match }];
  if (scope === 'saved')
    stages.push(
      {
        $lookup: {
          from: 'document_favorites',
          localField: '_id',
          foreignField: 'document',
          as: 'saved',
          pipeline: [{ $match: { user: oid(req.user.id) } }],
        },
      },
      { $match: { 'saved.0': { $exists: true } } },
      { $project: { saved: 0 } }
    );
  const sort =
    req.query.sort === 'helpful'
      ? { helpfulCount: -1, createdAt: -1, _id: -1 }
      : {
          createdAt: req.query.sort === 'oldest' ? 1 : -1,
          _id: req.query.sort === 'oldest' ? 1 : -1,
        };
  const [result] = await Document.aggregate([
    ...stages,
    {
      $facet: {
        count: [{ $count: 'total' }],
        data: [...counters, { $sort: sort }, { $skip: (page - 1) * limit }, { $limit: limit }],
      },
    },
  ]);
  await Document.populate(result.data, { path: 'author', select: fields });
  res.json({
    status: 'success',
    data: result.data,
    total: result.count[0]?.total || 0,
    page,
    limit,
  });
}
router.get('/catalog', (req, res) => success(res, { ...catalog, canModerate: moderator(req) }));
router.get(
  '/mine',
  asyncRoute((req, res) => list(req, res, 'mine'))
);
router.get(
  '/saved',
  asyncRoute((req, res) => list(req, res, 'saved'))
);
router.get(
  '/moderation/reports',
  requireModerator,
  asyncRoute(async (req, res) => {
    const { page, limit } = v.page(req.query);
    const status = req.query.status || 'pending';
    if (!['pending', 'dismissed', 'resolved'].includes(status))
      v.bad('Trạng thái báo cáo không hợp lệ.');
    const filter = { status };
    const [data, total] = await Promise.all([
      Report.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('reporter handledBy', fields)
        .populate('document', 'title status moderationReason'),
      Report.countDocuments(filter),
    ]);
    res.json({ status: 'success', data, total, page, limit });
  })
);
router.patch(
  '/moderation/reports/:reportId',
  requireModerator,
  asyncRoute(async (req, res) => {
    if (!['dismissed', 'resolved'].includes(req.body.status))
      v.bad('Trạng thái xử lý không hợp lệ.');
    const resolution = v.text(req.body.resolution, 'Lý do xử lý', 5, 1000);
    const report = await Report.findOneAndUpdate(
      { _id: oid(req.params.reportId), status: 'pending' },
      { status: req.body.status, resolution, handledBy: req.user.id, handledAt: new Date() },
      { new: true }
    );
    if (!report) throw new AppError('Báo cáo không tồn tại hoặc đã được xử lý.', 409);
    success(res, report);
  })
);
router.patch(
  '/moderation/documents/:id/status',
  requireModerator,
  asyncRoute(async (req, res) => {
    if (!['published', 'hidden'].includes(req.body.status))
      v.bad('Trạng thái tài liệu không hợp lệ.');
    const reason = v.text(req.body.reason, 'Lý do', 5, 1000);
    const doc = await Document.findOneAndUpdate(
      { _id: oid(req.params.id), status: { $ne: 'deleted' } },
      {
        status: req.body.status,
        moderationReason: reason,
        moderatedBy: req.user.id,
        moderatedAt: new Date(),
      },
      { new: true }
    );
    if (!doc) throw new AppError('Không tìm thấy tài liệu.', 404);
    success(res, doc);
  })
);
router.delete(
  '/comments/:commentId',
  asyncRoute(async (req, res) => {
    const item = await Comment.findById(oid(req.params.commentId));
    if (!item) throw new AppError('Không tìm thấy nhận xét.', 404);
    owned(req, item);
    await item.deleteOne();
    success(res, null);
  })
);
router.get(
  '/',
  asyncRoute((req, res) => list(req, res))
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: storage.maxBytes + 1, fields: 8, fieldSize: 32000 },
}).single('file');
router.post(
  '/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    keyGenerator: (req) => req.user.id,
    message: { message: 'Bạn đăng quá nhiều tài liệu. Vui lòng thử lại sau.' },
  }),
  upload,
  asyncRoute(async (req, res) => {
    const metadata = v.metadata(req.body);
    if (![true, 'true'].includes(req.body.rightsConfirmed))
      v.bad('Bạn cần xác nhận có quyền chia sẻ tài liệu.');
    const file = await storage.validate(req.file);
    // Give retries of the same selected file a stable document ID scoped to the uploader.
    let uploadId;
    if (req.body.uploadId !== undefined) {
      if (typeof req.body.uploadId !== 'string' || !/^[a-f0-9]{32}$/.test(req.body.uploadId))
        v.bad('Mã lượt đăng tài liệu không hợp lệ.');
      const hash = createHash('sha256')
        .update(req.user.id + ':' + req.body.uploadId)
        .digest();
      uploadId = new mongoose.Types.ObjectId(hash.subarray(0, 12));
      const existing = await Document.findOne({
        _id: uploadId,
        author: req.user.id,
        status: 'published',
      });
      if (existing) return success(res, existing);
    }
    const key = randomUUID() + '.' + file.format;
    await Cleanup.create({ key });
    let doc;
    try {
      await storage.write(key, req.file.buffer);
      doc = await Document.create({
        ...(uploadId && { _id: uploadId }),
        ...metadata,
        ...file,
        author: req.user.id,
        storageKey: key,
        rightsConfirmedAt: new Date(),
      });
    } catch (error) {
      try {
        await storage.remove(key);
        await Cleanup.deleteOne({ key });
      } catch (cleanupError) {
        console.error('Document cleanup queued:', cleanupError.message);
      }
      if (uploadId && error.code === 11000) {
        const existing = await Document.findOne({
          _id: uploadId,
          author: req.user.id,
          status: 'published',
        });
        if (existing) return success(res, existing);
      }
      throw error;
    }
    await Cleanup.deleteOne({ key }).catch((error) =>
      console.error('Document cleanup record retained:', error.message)
    );
    const data = doc.toObject();
    delete data.storageKey;
    success(res, data, 201);
  })
);
router.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const doc = await get(req, true);
    await doc.populate('author', fields);
    const [helpfulCount, isHelpful, isFavorite, commentCount] = await Promise.all([
      Vote.countDocuments({ document: doc.id }),
      Vote.exists({ document: doc.id, user: req.user.id }),
      Favorite.exists({ document: doc.id, user: req.user.id }),
      Comment.countDocuments({ document: doc.id }),
    ]);
    success(res, {
      ...doc.toObject(),
      helpfulCount,
      isHelpful: !!isHelpful,
      isFavorite: !!isFavorite,
      commentCount,
      canModerate: moderator(req),
    });
  })
);
router.patch(
  '/:id',
  asyncRoute(async (req, res) => {
    const doc = await get(req, true);
    owned(req, doc);
    const updated = await Document.findOneAndUpdate(
      { _id: doc._id, status: { $ne: 'deleted' } },
      v.metadata(req.body),
      { new: true }
    );
    if (!updated) throw new AppError('Tài liệu đã bị xóa.', 409);
    success(res, updated);
  })
);
router.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    const doc = await get(req, true);
    owned(req, doc);
    await Document.updateOne({ _id: doc._id }, { status: 'deleted' });
    await storage.sweep();
    success(res, null);
  })
);
for (const mode of ['preview', 'download'])
  router.get(
    '/:id/' + mode,
    asyncRoute(async (req, res, next) => {
      const doc = await get(req);
      if (mode === 'preview' && doc.format !== 'pdf')
        throw new AppError('Định dạng này chưa hỗ trợ xem trước. Hãy tải tài liệu xuống.', 415);
      const stored = await Document.findById(doc._id).select('+storageKey');
      if (!stored || stored.status !== 'published')
        throw new AppError('Tài liệu không còn được chia sẻ.', 404);
      res.set({
        'Content-Type': doc.mime,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (mode === 'preview') {
        res.set({
          'X-Frame-Options': 'SAMEORIGIN',
          'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'",
        });
      }
      const filename = encodeURIComponent(doc.originalName).replace(
        /['()*]/g,
        (c) => '%' + c.charCodeAt(0).toString(16)
      );
      res.set(
        'Content-Disposition',
        `${mode === 'preview' ? 'inline' : 'attachment'}; filename="document.${doc.format}"; filename*=UTF-8''${filename}`
      );
      res.sendFile(
        storage.location(stored.storageKey),
        { acceptRanges: true, cacheControl: false },
        (error) => {
          if (error && !res.headersSent)
            next(new AppError('Không thể đọc tệp tài liệu.', error.statusCode === 416 ? 416 : 404));
        }
      );
    })
  );
for (const [name, Model] of [
  ['favorite', Favorite],
  ['helpful', Vote],
])
  router
    .route('/:id/' + name)
    .put(
      asyncRoute(async (req, res) => {
        const doc = await get(req);
        if (name === 'helpful' && same(doc.author, req.user.id))
          throw new AppError('Bạn không thể bình chọn tài liệu của mình.', 403);
        try {
          await Model.updateOne(
            { document: doc._id, user: req.user.id },
            { $setOnInsert: { document: doc._id, user: req.user.id } },
            { upsert: true }
          );
        } catch (error) {
          if (error.code !== 11000) throw error;
        }
        if (!(await Document.exists({ _id: doc._id, status: 'published' }))) {
          await Model.deleteOne({ document: doc._id, user: req.user.id });
          throw new AppError('Tài liệu không còn được chia sẻ.', 409);
        }
        success(res, null);
      })
    )
    .delete(
      asyncRoute(async (req, res) => {
        await Model.deleteOne({ document: oid(req.params.id), user: req.user.id });
        success(res, null);
      })
    );
router.get(
  '/:id/comments',
  asyncRoute(async (req, res) => {
    const doc = await get(req, true);
    const { page, limit } = v.page(req.query);
    const [data, total] = await Promise.all([
      Comment.find({ document: doc.id })
        .sort({ createdAt: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('author', fields),
      Comment.countDocuments({ document: doc.id }),
    ]);
    res.json({ status: 'success', data, total, page, limit });
  })
);
router.post(
  '/:id/comments',
  asyncRoute(async (req, res) => {
    const doc = await get(req);
    const item = await Comment.create({
      document: doc.id,
      author: req.user.id,
      body: v.text(req.body.body, 'Nhận xét', 1, 1000),
    });
    if (!(await Document.exists({ _id: doc._id, status: 'published' }))) {
      await item.deleteOne();
      throw new AppError('Tài liệu không còn được chia sẻ.', 409);
    }
    success(res, item, 201);
  })
);
router.post(
  '/:id/reports',
  asyncRoute(async (req, res) => {
    const doc = await get(req);
    try {
      const report = await Report.create({
        document: doc.id,
        reporter: req.user.id,
        reason: v.choice(req.body.reason, catalog.reasons, 'Lý do'),
        body: v.text(req.body.body, 'Mô tả báo cáo', 5, 1000),
      });
      if (!(await Document.exists({ _id: doc._id, status: 'published' }))) {
        await report.deleteOne();
        throw new AppError('Tài liệu không còn được chia sẻ.', 409);
      }
      success(res, report, 201);
    } catch (error) {
      if (error.code === 11000)
        throw new AppError('Bạn đã gửi báo cáo đang chờ xử lý cho tài liệu này.', 409);
      throw error;
    }
  })
);
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.name === 'MulterError' ? 400 : error.statusCode || 500;
  if (status >= 500) console.error('Documents request failed:', error.message);
  res.status(status).json({
    status: 'error',
    message:
      error.name === 'MulterError'
        ? 'Chỉ nhận một tệp tối đa 20 MB và thông tin trong giới hạn cho phép.'
        : error.isOperational
          ? error.message
          : 'Không thể xử lý tài liệu. Vui lòng thử lại.',
  });
});
module.exports = router;
