const { randomInt } = require('node:crypto');
const Quiz = require('../models/Quiz');
const Room = require('../models/Room');
const Attempt = require('../models/Attempt');
const AppError = require('@ptitsocial/service-kit/appError');
const { withRoomLock } = require('../domain/locks');
const {
  shuffledOptions,
  rankAttempts,
  correctAnswers,
  validateSelection,
  roomDurationMinutes,
} = require('../domain/rules');
const engine = require('../domain/roomEngine');

exports.create = async (req, res) => {
  const quiz = await Quiz.findOne({ _id: req.body.quizId, deletedAt: null, status: 'ready' });
  if (!quiz || (quiz.ownerId !== req.user.id && quiz.visibility !== 'public'))
    throw new AppError('Bộ đề chưa sẵn sàng hoặc bạn không có quyền sử dụng.', 404);
  const maxPlayers = req.body.maxPlayers === undefined ? 30 : Number(req.body.maxPlayers);
  if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 100)
    throw new AppError('Phòng có thể chứa từ 1 đến 100 người chơi.', 400);
  for (const setting of ['shuffleOptions', 'speedBonus'])
    if (req.body[setting] !== undefined && typeof req.body[setting] !== 'boolean')
      throw new AppError('Thiết lập phòng không hợp lệ.', 400);
  let room;
  for (let tries = 0; tries < 10; tries++) {
    try {
      room = await Room.create({
        quizId: quiz._id,
        title: quiz.title,
        subject: quiz.subject,
        host: {
          id: req.user.id,
          name: `${req.user.last_name} ${req.user.first_name}`,
          photo: req.user.photo,
        },
        code: String(randomInt(100000, 1000000)),
        questions: quiz.questions.map((question) => question.toObject()),
        settings: {
          maxPlayers,
          shuffleOptions: req.body.shuffleOptions !== false,
          speedBonus: req.body.speedBonus !== false,
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      break;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  if (!room) throw new AppError('Chưa tạo được mã phòng, vui lòng thử lại.', 503);
  res.status(201).json({ status: 'success', data: { room: engine.publicRoom(room) } });
};

exports.join = async (req, res) => {
  const code = String(req.body.code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) throw new AppError('Mã phòng gồm 6 chữ số.', 400);
  const found = await Room.findOne({ code });
  if (!found) throw new AppError('Không tìm thấy mã phòng này.', 404);
  const data = await withRoomLock(found._id, async () => {
    const room = await Room.findById(found._id);
    await engine.refreshRoom(room);
    if (room.host.id === req.user.id) return { room: engine.publicRoom(room), role: 'host' };
    const existing = await Attempt.findOne({ roomId: room._id, userId: req.user.id });
    if (existing?.removed) throw new AppError('Bạn đã bị chủ phòng loại khỏi phòng.', 403);
    if (existing?.leftAt)
      throw new AppError(
        'Bạn đã rời lượt chơi này và không thể làm tiếp. Có thể xem lại kết quả trong lịch sử.',
        409
      );
    if (existing) return { room: engine.publicRoom(room), role: 'player' };
    if (room.status !== 'waiting') throw new AppError('Phòng đã bắt đầu hoặc đã kết thúc.', 409);
    if (
      (await Attempt.countDocuments({ roomId: room._id, removed: false })) >=
      room.settings.maxPlayers
    )
      throw new AppError('Phòng đã đủ người chơi.', 409);
    await Attempt.create({
      roomId: room._id,
      userId: req.user.id,
      name: `${req.user.last_name} ${req.user.first_name}`,
      photo: req.user.photo,
      optionOrders: room.questions.map(() => shuffledOptions(room.settings.shuffleOptions)),
    });
    engine.publishRoom(room._id);
    return { room: engine.publicRoom(room), role: 'player' };
  });
  res.json({ status: 'success', data });
};

exports.state = async (req, res) =>
  res.json({ status: 'success', data: await engine.roomState(req.params.roomId, req.user.id) });

exports.start = async (req, res) => {
  const data = await withRoomLock(req.params.roomId, async () => {
    const { room } = await engine.loadRoom(req.params.roomId, req.user.id, true);
    const attempts = await engine.refreshRoom(room);
    if (room.status !== 'waiting') throw new AppError('Phòng không còn ở trạng thái chờ.', 409);
    if (!attempts.length) throw new AppError('Cần ít nhất một người chơi để bắt đầu.', 400);
    room.status = 'running';
    room.startedAt = new Date();
    room.expiresAt = new Date(
      room.startedAt.getTime() + roomDurationMinutes(room.questions) * 60 * 1000
    );
    await room.save();
    for (const attempt of attempts) {
      attempt.phase = 'answering';
      attempt.questionStartedAt = room.startedAt;
      await attempt.save();
    }
    engine.publishRoom(room._id);
    return engine.packet(room, attempts, req.user.id);
  });
  res.json({ status: 'success', data });
};

exports.answer = async (req, res) => {
  const data = await withRoomLock(req.params.roomId, async () => {
    const { room, host } = await engine.loadRoom(req.params.roomId, req.user.id);
    if (host) throw new AppError('Chủ phòng điều phối và không tham gia trả lời.', 403);
    const attempts = await engine.refreshRoom(room);
    const attempt = attempts.find((attempt) => attempt.userId === req.user.id);
    if (attempt.leftAt) throw new AppError('Bạn đã rời phòng và không thể làm tiếp.', 409);
    const question = room.questions[attempt.cursor];
    if (req.body.questionId !== question?.id)
      throw new AppError('Câu hỏi đã thay đổi. Vui lòng tải lại.', 409);
    if (attempt.answers.some((answer) => answer.questionId === question.id))
      return engine.packet(room, attempts, req.user.id);
    if (room.status !== 'running' || attempt.phase !== 'answering')
      throw new AppError('Hiện không thể nộp câu trả lời.', 409);
    const choice =
      req.body.selectedIndices !== undefined ? req.body.selectedIndices : [req.body.selectedIndex];
    if (
      !validateSelection(choice) ||
      (correctAnswers(question).length === 1 && choice.length !== 1)
    )
      throw new AppError('Hãy chọn một đáp án trước khi nộp.', 400);
    await engine.record(room, attempt, choice);
    if (!(await engine.finishIfEveryoneDone(room, attempts))) engine.publishRoom(room._id);
    return engine.packet(room, attempts, req.user.id);
  });
  res.json({ status: 'success', data });
};

exports.next = async (req, res) => {
  const data = await withRoomLock(req.params.roomId, async () => {
    const { room, host } = await engine.loadRoom(req.params.roomId, req.user.id);
    if (host) throw new AppError('Chủ phòng không làm bài.', 403);
    const attempts = await engine.refreshRoom(room);
    const attempt = attempts.find((attempt) => attempt.userId === req.user.id);
    if (attempt.leftAt) throw new AppError('Bạn đã rời phòng và không thể làm tiếp.', 409);
    if (room.status === 'finished') {
      attempt.phase = 'completed';
      await attempt.save();
      return engine.packet(room, attempts, req.user.id);
    }
    if (attempt.phase !== 'feedback')
      throw new AppError('Cần nộp đáp án trước khi chuyển câu.', 409);
    if (req.body.questionId !== room.questions[attempt.cursor].id)
      throw new AppError('Yêu cầu chuyển câu đã cũ.', 409);
    if (attempt.answers.length === room.questions.length) {
      attempt.phase = 'completed';
      attempt.completedAt = new Date();
    } else {
      attempt.cursor += 1;
      attempt.phase = 'answering';
      attempt.questionStartedAt = new Date();
    }
    await attempt.save();
    engine.publishRoom(room._id);
    return engine.packet(room, attempts, req.user.id);
  });
  res.json({ status: 'success', data });
};

exports.end = async (req, res) => {
  const data = await withRoomLock(req.params.roomId, async () => {
    const { room } = await engine.loadRoom(req.params.roomId, req.user.id, true);
    const attempts = await engine.refreshRoom(room);
    if (room.status !== 'finished')
      await engine.finish(room, room.status === 'waiting' ? 'cancelled' : 'host_ended', attempts);
    return engine.packet(room, attempts, req.user.id);
  });
  res.json({ status: 'success', data });
};

exports.leave = async (req, res) => {
  await withRoomLock(req.params.roomId, async () => {
    const { room, host } = await engine.loadRoom(req.params.roomId, req.user.id);
    if (host)
      throw new AppError('Chủ phòng dùng nút kết thúc phòng hoặc rời trang để giữ phòng.', 403);
    const attempts = await engine.refreshRoom(room);
    const attempt = attempts.find((player) => player.userId === req.user.id);
    if (room.status === 'waiting') {
      // No game has started: free the seat, and allow joining again with the code.
      await Attempt.deleteOne({ _id: attempt._id });
    } else if (
      room.status === 'running' &&
      !attempt.leftAt &&
      attempt.answers.length < room.questions.length
    ) {
      // Keep earned points/history, but stop accepting answers for this player.
      attempt.leftAt = new Date();
      attempt.phase = 'completed';
      attempt.completedAt = attempt.leftAt;
      await attempt.save();
      await engine.finishIfEveryoneDone(room, attempts);
    }
    engine.publishRoom(room._id);
  });
  res.json({ status: 'success', data: { left: true } });
};

exports.kick = async (req, res) => {
  await withRoomLock(req.params.roomId, async () => {
    const { room } = await engine.loadRoom(req.params.roomId, req.user.id, true);
    if (room.status !== 'waiting')
      throw new AppError('Chỉ loại người chơi khi phòng đang chờ.', 409);
    const attempt = await Attempt.findOne({
      roomId: room._id,
      userId: req.params.userId,
      removed: false,
    });
    if (!attempt) throw new AppError('Không tìm thấy người chơi.', 404);
    attempt.removed = true;
    await attempt.save();
    engine.publishRoom(room._id);
  });
  res.json({ status: 'success', data: { removed: true } });
};

exports.results = async (req, res) => {
  const data = await withRoomLock(req.params.roomId, async () => {
    const { room, host } = await engine.loadRoom(req.params.roomId, req.user.id);
    const attempts = await engine.refreshRoom(room);
    const own = attempts.find((attempt) => attempt.userId === req.user.id);
    if (
      !host &&
      room.status !== 'finished' &&
      !own.leftAt &&
      own.answers.length !== room.questions.length
    )
      throw new AppError('Hoàn thành quiz để xem kết quả.', 403);
    const leaderboard = rankAttempts(attempts);
    const target = host ? req.query.userId || leaderboard[0]?.userId : req.user.id;
    if (!host && req.query.userId && req.query.userId !== req.user.id)
      throw new AppError('Bạn chỉ được xem chi tiết bài của mình.', 403);
    const selected = attempts.find((attempt) => attempt.userId === target);
    const review = selected
      ? room.questions.map((question, index) => {
          const answer = selected.answers.find((answer) => answer.questionId === question.id);
          return {
            id: question.id,
            index: index + 1,
            text: question.text,
            options: question.options,
            correctIndex: question.correctIndex,
            correctIndices: correctAnswers(question),
            explanation: question.explanation,
            answer: answer
              ? {
                  ...answer.toObject(),
                  selectedIndices:
                    answer.selectedIndices ??
                    (answer.selectedIndex === null ? [] : [answer.selectedIndex]),
                }
              : null,
          };
        })
      : [];
    return {
      room: engine.publicRoom(room),
      role: host ? 'host' : 'player',
      leaderboard,
      selected: leaderboard.find((player) => player.userId === target) || null,
      review,
      isFinal: room.status === 'finished',
    };
  });
  res.json({ status: 'success', data });
};

exports.history = async (req, res) => {
  const own = await Attempt.find({ userId: req.user.id, removed: false })
    .select('roomId score correctCount answers leftAt')
    .lean();
  const rooms = await Room.find({
    $or: [{ 'host.id': req.user.id }, { _id: { $in: own.map((attempt) => attempt.roomId) } }],
  })
    .sort('-createdAt')
    .limit(100);
  res.json({
    status: 'success',
    data: {
      rooms: rooms.map((room) => {
        const attempt = own.find((attempt) => String(attempt.roomId) === String(room._id));
        return {
          ...engine.publicRoom(room),
          role: room.host.id === req.user.id ? 'host' : 'player',
          score: attempt?.score,
          correctCount: attempt?.correctCount,
          left: Boolean(attempt?.leftAt),
          createdAt: room.createdAt,
        };
      }),
    },
  });
};
