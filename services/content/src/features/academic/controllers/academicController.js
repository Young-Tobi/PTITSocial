const mongoose = require('mongoose');
const Question = require('../models/questionModel');
const Answer = require('../models/answerModel');
const Comment = require('../models/answerCommentModel');
const Vote = require('../models/answerVoteModel');
const Interest = require('../models/interestModel');
const AppError = require('@ptitsocial/service-kit/appError');
const catchAsync = require('@ptitsocial/service-kit/catchAsync');
const { subjects } = require('../utils/subjects');
const validate = require('../utils/academicValidation');
const academicNotifications = require('../utils/academicNotifications');
const authorFields = 'first_name last_name username photo';
const success = (res, data, status = 200) => res.status(status).json({ status: 'success', data });
async function find(Model, id) {
  const doc = await Model.findById(validate.id(id));
  if (!doc) throw new AppError('Không tìm thấy nội dung yêu cầu.', 404);
  return doc;
}
async function questionCards(items) {
  const counts = await Answer.aggregate([
    { $match: { question: { $in: items.map((q) => q._id) } } },
    { $group: { _id: '$question', count: { $sum: 1 } } },
  ]);
  return items.map((q) => ({
    ...q,
    resolved: !!q.acceptedAnswer,
    answerCount: counts.find((c) => String(c._id) === String(q._id))?.count || 0,
  }));
}
async function answerCards(items, userId) {
  const ids = items.map((a) => a._id);
  const [votes, comments] = await Promise.all([
    Vote.aggregate([
      { $match: { answer: { $in: ids } } },
      {
        $group: {
          _id: '$answer',
          count: { $sum: 1 },
          mine: {
            $max: { $cond: [{ $eq: ['$user', new mongoose.Types.ObjectId(userId)] }, 1, 0] },
          },
        },
      },
    ]),
    Comment.aggregate([
      { $match: { answer: { $in: ids } } },
      { $group: { _id: '$answer', count: { $sum: 1 } } },
    ]),
  ]);
  return items.map((a) => {
    const vote = votes.find((v) => String(v._id) === String(a._id));
    return {
      ...a,
      helpfulCount: vote?.count || 0,
      isHelpful: !!vote?.mine,
      commentCount: comments.find((c) => String(c._id) === String(a._id))?.count || 0,
    };
  });
}
exports.subjects = (req, res) => success(res, subjects);
exports.list = catchAsync(async (req, res) => {
  const { page, limit } = validate.pagination(req.query);
  const filter = validate.filters(req.query);
  const [items, total] = await Promise.all([
    Question.find(filter)
      .select('-body')
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', authorFields)
      .lean(),
    Question.countDocuments(filter),
  ]);
  res.json({ status: 'success', data: await questionCards(items), page, limit, total });
});
exports.recommended = catchAsync(async (req, res) => {
  const interests = (await Interest.findOne({ user: req.user.id }).lean()) || {
    subjects: [],
    tags: [],
  };
  let items = await Question.aggregate([
    {
      $match: {
        $or: [
          { subject: { $in: interests.subjects || [] } },
          { tags: { $in: interests.tags || [] } },
        ],
      },
    },
    {
      $addFields: {
        score: {
          $add: [
            { $cond: [{ $in: ['$subject', interests.subjects || []] }, 2, 0] },
            { $size: { $setIntersection: ['$tags', interests.tags || []] } },
          ],
        },
      },
    },
    { $sort: { score: -1, createdAt: -1, _id: -1 } },
    { $limit: 6 },
    { $project: { body: 0 } },
  ]);
  if (!items.length)
    items = await Question.find().select('-body').sort({ createdAt: -1, _id: -1 }).limit(6).lean();
  await Question.populate(items, { path: 'author', select: authorFields });
  success(res, await questionCards(items));
});
exports.create = catchAsync(async (req, res) => {
  if (!req.is('application/json'))
    throw new AppError('Vui lòng gửi câu hỏi dạng JSON, không đính kèm tệp.', 415);
  const fields = validate.question(req.body);
  const question = await Question.create({ ...fields, author: req.user.id });
  success(res, question, 201);
});
exports.detail = catchAsync(async (req, res) => {
  const question = await find(Question, req.params.id);
  await question.populate('author', authorFields);
  let acceptedAnswer = null;
  if (question.acceptedAnswer) {
    const answer = await Answer.findById(question.acceptedAnswer)
      .populate('author', authorFields)
      .lean();
    if (answer) [acceptedAnswer] = await answerCards([answer], req.user.id);
  }
  success(res, { ...question.toObject(), resolved: !!question.acceptedAnswer, acceptedAnswer });
});
exports.answers = catchAsync(async (req, res) => {
  const question = await find(Question, req.params.id);
  const { page, limit } = validate.pagination(req.query);
  const filter = { question: question._id, _id: { $ne: question.acceptedAnswer } };
  const [items, total] = await Promise.all([
    Answer.find(filter)
      .sort({ createdAt: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', authorFields)
      .lean(),
    Answer.countDocuments(filter),
  ]);
  res.json({ status: 'success', data: await answerCards(items, req.user.id), page, limit, total });
});
exports.answer = catchAsync(async (req, res) => {
  const question = await find(Question, req.params.id);
  if (String(question.author) === req.user.id)
    throw new AppError('Người đặt câu hỏi có thể trao đổi trong phần bình luận.', 403);
  const answer = await Answer.create({
    question: question._id,
    author: req.user.id,
    body: validate.text(req.body.body, 'Câu trả lời', 10, 20000),
    notificationPending: true,
  });
  await academicNotifications.notify('answer', answer);
  const result = answer.toObject();
  delete result.notificationPending;
  success(res, result, 201);
});
exports.comments = catchAsync(async (req, res) => {
  const answer = await find(Answer, req.params.id);
  const { page, limit } = validate.pagination(req.query);
  const [data, total] = await Promise.all([
    Comment.find({ answer: answer._id })
      .sort({ createdAt: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', authorFields)
      .lean(),
    Comment.countDocuments({ answer: answer._id }),
  ]);
  res.json({ status: 'success', data, page, limit, total });
});
exports.comment = catchAsync(async (req, res) => {
  const answer = await find(Answer, req.params.id);
  const comment = await Comment.create({
    answer: answer._id,
    author: req.user.id,
    body: validate.text(req.body.body, 'Bình luận', 1, 1000),
    notificationPending: true,
  });
  await academicNotifications.notify('comment', comment);
  const result = comment.toObject();
  delete result.notificationPending;
  success(res, result, 201);
});
exports.helpful = catchAsync(async (req, res) => {
  const answer = await find(Answer, req.params.id);
  if (String(answer.author) === req.user.id)
    throw new AppError('Bạn không thể bình chọn câu trả lời của mình.', 403);
  const filter = { answer: answer._id, user: req.user.id };
  if (req.method === 'DELETE') await Vote.deleteOne(filter);
  else {
    await Vote.init();
    try {
      await Vote.updateOne(filter, { $setOnInsert: filter }, { upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  success(res, {
    helpfulCount: await Vote.countDocuments({ answer: answer._id }),
    isHelpful: !!(await Vote.exists(filter)),
  });
});
exports.accept = catchAsync(async (req, res) => {
  const question = await find(Question, req.params.id);
  if (String(question.author) !== req.user.id)
    throw new AppError('Chỉ người đặt câu hỏi được chọn lời giải.', 403);
  const answerId = req.body.answerId;
  if (answerId !== null) {
    const answer = await find(Answer, answerId);
    if (!answer.question.equals(question._id))
      throw new AppError('Câu trả lời không thuộc câu hỏi này.', 400);
  }
  await Question.updateOne(
    { _id: question._id, author: req.user.id },
    { $set: { acceptedAnswer: answerId } }
  );
  success(res, { acceptedAnswer: answerId, resolved: answerId !== null });
});
