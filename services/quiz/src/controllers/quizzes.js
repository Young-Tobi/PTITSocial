const Quiz = require('../models/Quiz');
const { normalizeQuiz, roomDurationMinutes } = require('../domain/rules');
const AppError = require('@ptitsocial/service-kit/appError');

function summary(quiz, userId) {
  return {
    id: String(quiz._id),
    title: quiz.title,
    description: quiz.description,
    subject: quiz.subject,
    status: quiz.status,
    visibility: quiz.visibility,
    questionCount: quiz.questions.length,
    timeLimitMinutes: roomDurationMinutes(quiz.questions),
    ownerName: quiz.ownerName,
    isOwner: quiz.ownerId === userId,
    updatedAt: quiz.updatedAt,
  };
}

async function owned(id, userId) {
  const quiz = await Quiz.findOne({ _id: id, ownerId: userId, deletedAt: null });
  if (!quiz) throw new AppError('Không tìm thấy bộ đề của bạn.', 404);
  return quiz;
}

exports.list = async (req, res) => {
  const filter = { deletedAt: null };
  if (req.query.view === 'discover') {
    filter.visibility = 'public';
    filter.status = 'ready';
  } else {
    filter.ownerId = req.user.id;
    if (['draft', 'ready'].includes(req.query.status)) filter.status = req.query.status;
  }
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const pattern = req.query.search
      .trim()
      .slice(0, 100)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { title: { $regex: pattern, $options: 'i' } },
      { subject: { $regex: pattern, $options: 'i' } },
    ];
  }
  const quizzes = await Quiz.find(filter).sort('-updatedAt').limit(100);
  res.json({
    status: 'success',
    data: { quizzes: quizzes.map((quiz) => summary(quiz, req.user.id)) },
  });
};
exports.create = async (req, res) => {
  const quiz = await Quiz.create({
    ...normalizeQuiz(req.body),
    ownerId: req.user.id,
    ownerName: `${req.user.first_name} ${req.user.last_name}`,
  });
  res.status(201).json({ status: 'success', data: { quiz } });
};
exports.get = async (req, res) =>
  res.json({ status: 'success', data: { quiz: await owned(req.params.quizId, req.user.id) } });
exports.update = async (req, res) => {
  const quiz = await owned(req.params.quizId, req.user.id);
  Object.assign(quiz, normalizeQuiz(req.body));
  await quiz.save();
  res.json({ status: 'success', data: { quiz } });
};
exports.remove = async (req, res) => {
  const quiz = await owned(req.params.quizId, req.user.id);
  quiz.deletedAt = new Date();
  await quiz.save();
  res.json({ status: 'success', data: { deleted: true } });
};
