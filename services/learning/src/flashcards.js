const express = require('express');
const mongoose = require('mongoose');
const AppError = require('@ptitsocial/service-kit/appError');
const catchAsync = require('@ptitsocial/service-kit/catchAsync');
const { Session } = require('./models');
const { config } = require('./config');
const { generate } = require('./provider');

const cardSchema = new mongoose.Schema({
  front: { type: String, required: true },
  back: { type: String, required: true },
  dueAt: { type: Date, default: Date.now },
  intervalDays: { type: Number, default: 0 },
  repetitions: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  lastReviewedAt: Date,
});
const deckSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    sourceGuide: mongoose.Schema.Types.ObjectId,
    cards: [cardSchema],
    reviewLog: [{ _id: false, requestId: String, cardId: String, rating: String, at: Date }],
  },
  { timestamps: true }
);
deckSchema.index({ user: 1, updatedAt: -1 });
const Deck = mongoose.model('FlashcardDeck', deckSchema);
const DAY = 86400000;

// A small, deterministic spaced-repetition rule, intentionally simpler than SM-2/FSRS.
function schedule(card, rating, now = new Date()) {
  if (!['again', 'hard', 'good'].includes(rating))
    throw new AppError('Vui lòng chọn Quên, Khó hoặc Nhớ.', 400);
  const repetitions = rating === 'again' ? 0 : card.repetitions + (rating === 'good' ? 1 : 0);
  const intervalDays =
    rating === 'again'
      ? 0
      : rating === 'hard'
        ? Math.min(365, Math.max(1, Math.ceil(card.intervalDays * 1.2)))
        : repetitions === 1
          ? 1
          : repetitions === 2
            ? 3
            : Math.min(365, Math.max(7, Math.round(card.intervalDays * 2)));
  return {
    intervalDays,
    repetitions,
    reviews: card.reviews + 1,
    lastReviewedAt: now,
    dueAt: new Date(now.getTime() + (rating === 'again' ? 600000 : intervalDays * DAY)),
  };
}
function clean(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new AppError(`${label} phải có từ 1 đến ${max} ký tự.`, 400);
  return value.trim();
}
function validateCards(cards, ai = false) {
  if (!Array.isArray(cards) || cards.length < 1 || cards.length > (ai ? 12 : 100))
    throw new AppError(
      ai ? 'AI chưa tạo được bộ thẻ hợp lệ. Hãy thử lại.' : 'Mỗi bộ cần từ 1 đến 100 thẻ.',
      ai ? 502 : 400
    );
  return cards.map((card) => ({
    ...(card?._id ? { _id: card._id } : {}),
    front: clean(card?.front, 1000, 'Câu hỏi'),
    back: clean(card?.back, 6000, 'Đáp án'),
  }));
}
function serialize(deck, now = new Date()) {
  const value = deck.toObject ? deck.toObject() : deck;
  const dayKey = (date) =>
    new Date(new Date(date).getTime() + 7 * 3600000).toISOString().slice(0, 10);
  return {
    _id: value._id,
    title: value.title,
    sourceGuide: value.sourceGuide,
    version: value.__v,
    cards: value.cards,
    updatedAt: value.updatedAt,
    total: value.cards.length,
    due: value.cards.filter((card) => new Date(card.dueAt) <= now).length,
    learned: value.cards.filter((card) => card.repetitions > 0).length,
    reviewedToday: value.cards.filter(
      (card) => card.lastReviewedAt && dayKey(card.lastReviewedAt) === dayKey(now)
    ).length,
    nextDueAt: value.cards.length
      ? new Date(Math.min(...value.cards.map((card) => new Date(card.dueAt).getTime())))
      : null,
  };
}
function flashcardRouter({ reserve, generationLimit }) {
  const router = express.Router();
  router.param('deckId', (req, res, next, id) =>
    /^[a-f0-9]{24}$/i.test(id) ? next() : next(new AppError('Mã bộ thẻ không hợp lệ.', 400))
  );
  const owned = async (req) => {
    const deck = await Deck.findOne({ _id: req.params.deckId, user: req.user.id });
    if (!deck) throw new AppError('Không tìm thấy bộ thẻ.', 404);
    return deck;
  };
  const version = (req, deck) => {
    if (!Number.isInteger(req.body.version) || req.body.version !== deck.__v)
      throw new AppError('Bộ thẻ đã thay đổi ở cửa sổ khác. Hãy tải lại trước khi tiếp tục.', 409);
  };
  const save = async (req, deck, fields, extra = {}) => {
    const updated = await Deck.findOneAndUpdate(
      { _id: deck._id, user: req.user.id, __v: deck.__v },
      { $set: fields, $inc: { __v: 1 }, ...extra },
      { new: true, runValidators: true }
    );
    if (!updated) throw new AppError('Bộ thẻ vừa được cập nhật. Hãy tải lại và thử tiếp.', 409);
    return updated;
  };
  router.get(
    '/',
    catchAsync(async (req, res) => {
      const decks = await Deck.find({ user: req.user.id }).sort('-updatedAt');
      res.json({
        decks: decks.map((deck) => {
          const { cards, ...summary } = serialize(deck);
          return summary;
        }),
      });
    })
  );
  router.post(
    '/generate',
    generationLimit,
    catchAsync(async (req, res) => {
      if (!/^[a-f0-9]{24}$/i.test(req.body.guideId || ''))
        throw new AppError('Vui lòng chọn một bài Guide.', 400);
      const guide = await Session.findOne({
        _id: req.body.guideId,
        user: req.user.id,
        kind: 'guide',
      });
      if (!guide) throw new AppError('Không tìm thấy bài Guide.', 404);
      const content =
        guide.guide || guide.messages.find((message) => message.role === 'assistant')?.content;
      if (!content) throw new AppError('Bài Guide chưa có nội dung.', 400);
      const settings = config();
      await reserve(req.user.id, settings);
      const result = await generate({ mode: 'flashcards', guide: content }, settings);
      const cards = validateCards(result.cards, true).map(({ front, back }) => ({ front, back }));
      res.json({ title: `Ôn tập: ${guide.goal}`.slice(0, 120), sourceGuide: guide._id, cards });
    })
  );
  router.post(
    '/',
    catchAsync(async (req, res) => {
      const title = clean(req.body.title, 120, 'Tên bộ thẻ');
      const cards = validateCards(req.body.cards).map(({ front, back }) => ({ front, back }));
      let sourceGuide;
      if (req.body.sourceGuide) {
        if (
          !/^[a-f0-9]{24}$/i.test(req.body.sourceGuide) ||
          !(await Session.exists({ _id: req.body.sourceGuide, user: req.user.id, kind: 'guide' }))
        )
          throw new AppError('Không tìm thấy bài Guide.', 404);
        sourceGuide = req.body.sourceGuide;
      }
      const deck = await Deck.create({ user: req.user.id, title, cards, sourceGuide });
      res.status(201).json({ deck: serialize(deck) });
    })
  );
  router.get(
    '/:deckId',
    catchAsync(async (req, res) => res.json({ deck: serialize(await owned(req)) }))
  );
  router.put(
    '/:deckId',
    catchAsync(async (req, res) => {
      const deck = await owned(req);
      version(req, deck);
      const title = clean(req.body.title, 120, 'Tên bộ thẻ');
      const ids = new Set();
      const cards = validateCards(req.body.cards).map((card) => {
        if (!card._id) return card;
        const old = deck.cards.find((item) => String(item._id) === card._id);
        if (!old || ids.has(card._id)) throw new AppError('Danh sách thẻ không hợp lệ.', 400);
        ids.add(card._id);
        return old.front === card.front && old.back === card.back ? old.toObject() : card;
      });
      res.json({ deck: serialize(await save(req, deck, { title, cards })) });
    })
  );
  router.delete(
    '/:deckId',
    catchAsync(async (req, res) => {
      const deck = await owned(req);
      version(req, deck);
      const result = await Deck.deleteOne({ _id: deck._id, user: req.user.id, __v: deck.__v });
      if (!result.deletedCount) throw new AppError('Bộ thẻ đã thay đổi. Hãy tải lại.', 409);
      res.json({ deleted: true });
    })
  );
  router.post(
    '/:deckId/reviews',
    catchAsync(async (req, res) => {
      const deck = await owned(req);
      const { requestId, cardId, rating } = req.body;
      if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId))
        throw new AppError('Mã lượt ôn không hợp lệ.', 400);
      const previous = deck.reviewLog.find((event) => event.requestId === requestId);
      if (previous) {
        if (previous.cardId !== cardId || previous.rating !== rating)
          throw new AppError('Mã lượt ôn đã được sử dụng.', 409);
        return res.json({ deck: serialize(deck), repeated: true });
      }
      version(req, deck);
      const card = deck.cards.find((item) => String(item._id) === cardId);
      if (!card) throw new AppError('Không tìm thấy thẻ.', 404);
      const now = new Date();
      if (card.dueAt > now) throw new AppError('Thẻ này chưa đến lịch ôn.', 409);
      Object.assign(card, schedule(card, rating, now));
      const event = { requestId, cardId, rating, at: now };
      const updated = await save(
        req,
        deck,
        { cards: deck.cards },
        { $push: { reviewLog: { $each: [event], $slice: -100 } } }
      );
      res.json({ deck: serialize(updated) });
    })
  );
  return router;
}
module.exports = { flashcardRouter, Deck, schedule, validateCards, serialize };
