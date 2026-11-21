const { randomInt } = require('node:crypto');
const { Room, Problem, Submission } = require('./models');
const AppError = require('@ptitsocial/service-kit/appError');
const { roomSettings, problemId } = require('./rules');
const { withRoomLock } = require('./locks');
const engine = require('./engine');
const judge = require('./judge');
const { getLanguage } = require('./languages');
const person = (user) => ({
  userId: user.id,
  name: `${user.last_name} ${user.first_name}`,
  photo: user.photo,
});
exports.status = async (req, res) => {
  let result;
  try {
    result = await judge.ready();
  } catch (error) {
    result = { ready: false, message: error.message };
  }
  res.json({ data: result });
};
exports.problems = async (req, res) => {
  const problems = await Problem.find().sort({ difficulty: 1, title: 1 });
  res.json({ data: { problems: problems.map(engine.publicProblem) } });
};
exports.list = async (req, res) => {
  const view = req.query.view || 'discover';
  let filter;
  if (view === 'mine') filter = { hostId: req.user.id };
  else if (view === 'joined')
    filter = { 'players.userId': req.user.id, status: { $ne: 'finished' } };
  else if (view === 'history')
    filter = {
      status: 'finished',
      $or: [{ hostId: req.user.id }, { 'players.userId': req.user.id }],
    };
  else if (view === 'discover')
    filter = { visibility: 'public', status: { $in: ['waiting', 'running'] } };
  else throw new AppError('Danh sách phòng không hợp lệ.', 400);
  const rooms = await Room.find(filter).sort('-createdAt').limit(100);
  res.json({ data: { rooms: rooms.map((room) => engine.summary(room, req.user.id)) } });
};
exports.create = async (req, res) => {
  const { problemIds, ...settings } = roomSettings(req.body);
  const found = await Problem.find({ _id: { $in: problemIds } }).lean();
  if (found.length !== problemIds.length || found.some((p) => !p.tests.length || !p.samples.length))
    throw new AppError('Một số đề không tồn tại hoặc chưa sẵn sàng để chấm.', 400);
  const problems = problemIds.map((id) => found.find((p) => problemId(p) === id));
  let room;
  for (let attempt = 0; attempt < 10; attempt++)
    try {
      room = await Room.create({
        ...settings,
        problems,
        code: String(randomInt(100000, 1000000)),
        hostId: req.user.id,
        hostName: person(req.user).name,
        hostPhoto: req.user.photo,
        players: [],
        expiresAt: new Date(Date.now() + 24 * 3600000),
      });
      break;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  if (!room) throw new AppError('Không tạo được mã phòng, vui lòng thử lại.', 503);
  res.status(201).json({ data: { room: engine.summary(room, req.user.id) } });
};
async function joinRoom(found, user) {
  return withRoomLock(found._id, async () => {
    const room = await Room.findById(found._id);
    await engine.refresh(room);
    if (room.hostId === user.id)
      throw new AppError('Bạn là người tổ chức, không tham gia thi đấu.', 403);
    if (room.blockedIds.includes(user.id))
      throw new AppError('Bạn đã được mời rời phòng này.', 403);
    const existing = room.players.find((p) => p.userId === user.id);
    if (existing?.leftAt)
      throw new AppError('Bạn đã rời lượt thi này, chỉ có thể xem kết quả.', 409);
    if (existing) return room;
    if (room.status !== 'waiting') throw new AppError('Chỉ được tham gia phòng đang chờ.', 409);
    if (room.players.length >= room.maxPlayers) throw new AppError('Phòng đã đủ người thi.', 409);
    room.players.push(person(user));
    await room.save();
    engine.publish(room._id);
    return room;
  });
}
exports.join = async (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!/^\d{6}$/.test(code)) throw new AppError('Mã phòng gồm 6 chữ số.', 400);
  const found = await Room.findOne({ code });
  if (!found) throw new AppError('Không tìm thấy mã phòng.', 404);
  const room = await joinRoom(found, req.user);
  res.json({ data: { room: engine.summary(room, req.user.id) } });
};
exports.joinPublic = async (req, res) => {
  const found = await Room.findById(req.params.roomId);
  if (!found) throw new AppError('Không tìm thấy phòng.', 404);
  if (found.visibility !== 'public')
    throw new AppError('Phòng riêng tư cần tham gia bằng mã.', 403);
  const room = await joinRoom(found, req.user);
  res.json({ data: { room: engine.summary(room, req.user.id) } });
};
exports.state = async (req, res) =>
  res.json({ data: await engine.state(req.params.roomId, req.user.id) });
exports.start = async (req, res) => {
  await withRoomLock(req.params.roomId, async () => {
    const { room, isHost } = await engine.member(req.params.roomId, req.user.id);
    await engine.refresh(room);
    if (!isHost) throw new AppError('Chỉ người tổ chức được bắt đầu.', 403);
    if (room.status !== 'waiting') throw new AppError('Phòng không còn ở trạng thái chờ.', 409);
    if (room.players.length < 2) throw new AppError('Cần ít nhất 2 người thi để bắt đầu.', 400);
    if (!room.problems.length) throw new AppError('Phòng chưa có đề bài.', 400);
    await judge.ready();
    room.status = 'running';
    room.startedAt = new Date();
    room.endsAt = new Date(+room.startedAt + room.durationMinutes * 60000);
    await room.save();
    engine.publish(room._id);
  });
  res.json({ data: await engine.state(req.params.roomId, req.user.id) });
};
exports.leave = async (req, res) => {
  await withRoomLock(req.params.roomId, async () => {
    const { room, player, isHost } = await engine.member(req.params.roomId, req.user.id);
    await engine.refresh(room);
    if (isHost) throw new AppError('Người tổ chức có thể về danh sách hoặc kết thúc phòng.', 403);
    if (room.status === 'waiting')
      room.players = room.players.filter((p) => p.userId !== req.user.id);
    else if (room.status === 'running') player.leftAt = player.leftAt || new Date();
    await room.save();
    await engine.refresh(room);
    engine.publish(room._id);
  });
  res.json({ data: { left: true } });
};
exports.kick = async (req, res) => {
  const userId = req.body.userId;
  if (typeof userId !== 'string' || !/^[a-f0-9]{24}$/i.test(userId))
    throw new AppError('Người thi không hợp lệ.', 400);
  await withRoomLock(req.params.roomId, async () => {
    const { room, isHost } = await engine.member(req.params.roomId, req.user.id);
    await engine.refresh(room);
    if (!isHost) throw new AppError('Chỉ người tổ chức được mời người thi rời phòng.', 403);
    if (room.status !== 'waiting')
      throw new AppError('Chỉ được mời người thi rời phòng khi đang chờ.', 409);
    if (!room.players.some((p) => p.userId === userId))
      throw new AppError('Người thi không còn trong phòng.', 404);
    room.players = room.players.filter((p) => p.userId !== userId);
    room.blockedIds.push(userId);
    await room.save();
    engine.publish(room._id);
  });
  res.json({ data: { removed: true } });
};
exports.end = async (req, res) => {
  await withRoomLock(req.params.roomId, async () => {
    const { room, isHost } = await engine.member(req.params.roomId, req.user.id);
    if (!isHost) throw new AppError('Chỉ người tổ chức được kết thúc.', 403);
    if (room.status === 'waiting') {
      room.status = 'finished';
      room.finishReason = 'cancelled';
    }
    if (room.status === 'running') {
      room.endsAt = new Date();
      room.finishReason = 'host_ended';
    }
    await room.save();
    await engine.refresh(room);
    engine.publish(room._id);
  });
  res.json({ data: await engine.state(req.params.roomId, req.user.id) });
};
exports.submit = async (req, res) => {
  const { code, requestId, problemId: selectedId } = req.body;
  if (typeof code !== 'string' || !code.trim() || Buffer.byteLength(code) > 32000)
    throw new AppError('Code phải có nội dung và tối đa 32 KB.', 400);
  if (typeof requestId !== 'string' || !/^[\w-]{8,80}$/.test(requestId))
    throw new AppError('ID lần nộp không hợp lệ.', 400);
  if (typeof selectedId !== 'string' || !/^[a-f0-9]{24}$/i.test(selectedId))
    throw new AppError('Chọn đề cần chạy hoặc nộp bài.', 400);
  const language = req.body.language ?? 'cpp';
  getLanguage(language);
  const submission = await withRoomLock('submission-queue', () =>
    withRoomLock(req.params.roomId, async () => {
      const { room, player, isHost } = await engine.member(req.params.roomId, req.user.id);
      await engine.refresh(room);
      if (isHost) throw new AppError('Người tổ chức không được chạy hoặc nộp bài thi.', 403);
      const problem = room.problems.find((p) => problemId(p) === selectedId.toLowerCase());
      if (!problem) throw new AppError('Đề không thuộc cuộc thi này.', 400);
      const existing = await Submission.findOne({
        roomId: room._id,
        userId: req.user.id,
        requestId,
      });
      if (existing) {
        if (
          existing.problemId !== problemId(problem) ||
          existing.mode !== req.params.mode ||
          existing.code !== code ||
          (existing.language || 'cpp') !== language
        )
          throw new AppError('ID lần nộp đã được dùng cho bài khác.', 409);
        return existing;
      }
      if (room.status !== 'running' || Date.now() >= +room.endsAt)
        throw new AppError('Cuộc thi đã hết thời gian nộp bài.', 409);
      if (player.leftAt) throw new AppError('Bạn đã rời lượt thi này.', 409);
      const score = player.scores.find((s) => s.problemId === problemId(problem));
      if (score?.passed === problem.tests.length)
        throw new AppError('Bạn đã giải đúng toàn bộ test của đề này.', 409);
      if (await Submission.exists({ userId: req.user.id, status: { $in: ['queued', 'judging'] } }))
        throw new AppError('Bài trước đang được chấm, vui lòng chờ.', 409);
      if ((await Submission.countDocuments({ status: { $in: ['queued', 'judging'] } })) >= 24)
        throw new AppError('Hàng đợi chấm đang đầy, thử lại sau.', 503);
      return Submission.create({
        roomId: room._id,
        userId: req.user.id,
        problemId: problemId(problem),
        requestId,
        code,
        language,
        mode: req.params.mode,
        receivedAt: new Date(),
      });
    })
  );
  engine.publish(req.params.roomId);
  res.status(202).json({ data: { id: String(submission._id) } });
};
exports.code = async (req, res) => {
  const submission = await Submission.findOne({
    _id: req.params.submissionId,
    userId: req.user.id,
  });
  if (!submission) throw new AppError('Không tìm thấy bài nộp của bạn.', 404);
  res.json({ data: { code: submission.code, language: submission.language || 'cpp' } });
};
