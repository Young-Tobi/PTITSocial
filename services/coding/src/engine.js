const { Room, Submission } = require('./models');
const { leaderboard, problemId, solvedAll, pointsFor } = require('./rules');
const AppError = require('@ptitsocial/service-kit/appError');
const { withRoomLock } = require('./locks');
let publish = () => {},
  online = () => false;
function configureRealtime(callbacks) {
  publish = callbacks.publish;
  online = callbacks.online;
}
async function member(roomId, userId) {
  const room = await Room.findById(roomId);
  if (!room) throw new AppError('Không tìm thấy phòng thi.', 404);
  const player = room.players.find((item) => item.userId === userId),
    isHost = room.hostId === userId;
  if (!isHost && !player)
    throw new AppError('Bạn chưa tham gia phòng này hoặc đã được mời rời phòng.', 403);
  return { room, player, isHost };
}
async function refresh(room) {
  if (room.status === 'waiting' && Date.now() >= +room.expiresAt) {
    room.status = 'finished';
    room.finishReason = 'expired';
    await room.save();
    publish(String(room._id));
  }
  if (room.status !== 'running') return;
  const everyoneDone =
    room.players.length > 0 &&
    room.players.every((player) => player.leftAt || solvedAll(room, player));
  if (Date.now() < +room.endsAt && !everyoneDone) return;
  const pending = await Submission.countDocuments({
    roomId: room._id,
    mode: 'submit',
    status: { $in: ['queued', 'judging'] },
  });
  if (!pending) {
    room.status = 'finished';
    room.finishReason = room.finishReason || (everyoneDone ? 'all_done' : 'timeout');
    await room.save();
    publish(String(room._id));
  }
}
function publicProblem(problem, index) {
  return {
    id: problemId(problem),
    letter: String.fromCharCode(65 + index),
    title: problem.title,
    difficulty: problem.difficulty,
    description: problem.description,
    inputFormat: problem.inputFormat,
    outputFormat: problem.outputFormat,
    constraints: problem.constraints,
    starterCode: problem.starterCode,
    samples: problem.samples.map((test) => ({ input: test.input, output: test.output })),
    timeLimit: problem.timeLimit,
    memoryLimit: problem.memoryLimit,
  };
}
function summary(room, userId) {
  const player = room.players.find((item) => item.userId === userId),
    isHost = room.hostId === userId;
  return {
    id: String(room._id),
    title: room.title,
    code: isHost || player ? room.code : undefined,
    status: room.status,
    hostId: room.hostId,
    hostName: room.hostName,
    hostPhoto: room.hostPhoto,
    visibility: room.visibility,
    durationMinutes: room.durationMinutes,
    maxPlayers: room.maxPlayers,
    playerCount: room.players.length,
    problemCount: room.problems.length,
    maxPoints: room.problems.length * 100,
    startedAt: room.startedAt,
    endsAt: room.endsAt,
    createdAt: room.createdAt,
    finishReason: room.finishReason,
    isHost,
    hasJoined: !!player,
    left: !!player?.leftAt,
    legacy: room.legacy,
    canJoin:
      !isHost &&
      !player &&
      room.status === 'waiting' &&
      room.players.length < room.maxPlayers &&
      !room.blockedIds.includes(userId),
  };
}
function submissionSummary(item, room, own) {
  return {
    id: String(item._id),
    problemId: item.problemId,
    userId: item.userId,
    mode: item.mode,
    language: item.language || 'cpp',
    status: item.status,
    passed: item.passed,
    total: item.total,
    points: item.mode === 'submit' ? pointsFor(item.passed, item.total) : undefined,
    verdict: item.verdict,
    receivedAt: item.receivedAt,
    elapsedSeconds: room.startedAt
      ? Math.max(0, Math.floor((item.receivedAt - room.startedAt) / 1000))
      : 0,
    ...(own
      ? {
          compileOutput: item.compileOutput,
          error: item.error,
          results: item.mode === 'run' ? item.results : undefined,
        }
      : {}),
  };
}
async function state(roomId, userId) {
  return withRoomLock(roomId, async () => {
    const { room, player, isHost } = await member(roomId, userId);
    await refresh(room);
    const own = await Submission.find({ roomId, userId }).sort('-receivedAt').limit(200).lean();
    const activity = isHost
      ? await Submission.find({ roomId, mode: 'submit' }).sort('-receivedAt').limit(30).lean()
      : [];
    const pending = await Submission.countDocuments({
      roomId,
      status: { $in: ['queued', 'judging'] },
    });
    const submissionCount = isHost
      ? await Submission.countDocuments({ roomId, mode: 'submit' })
      : undefined;
    const showProblems = isHost || room.status !== 'waiting';
    return {
      room: summary(room, userId),
      serverNow: Date.now(),
      me: {
        userId,
        isHost,
        left: !!player?.leftAt,
        solved: player ? solvedAll(room, player) : false,
      },
      players: room.players.map((item) => ({
        userId: item.userId,
        name: item.name,
        photo: item.photo,
        left: !!item.leftAt,
        solved: solvedAll(room, item),
        online: online(roomId, item.userId),
      })),
      leaderboard: room.status === 'waiting' ? [] : leaderboard(room),
      problems: showProblems ? room.problems.map(publicProblem) : [],
      submissions: own.map((item) => submissionSummary(item, room, true)),
      activity: activity.map((item) => ({
        ...submissionSummary(item, room, false),
        name: room.players.find((p) => p.userId === item.userId)?.name || 'Người thi',
      })),
      pending,
      submissionCount,
      judging: Date.now() >= (+room.endsAt || Infinity) && room.status === 'running',
    };
  });
}
function startClock() {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const rooms = await Room.find({ status: { $in: ['waiting', 'running'] } }).select('_id');
      for (const row of rooms)
        await withRoomLock(row._id, async () => {
          const room = await Room.findById(row._id);
          if (room) await refresh(room);
        });
    } catch (error) {
      console.error('Coding clock:', error.message);
    } finally {
      busy = false;
    }
  }, 1000);
  timer.unref();
}
module.exports = {
  member,
  refresh,
  state,
  summary,
  publicProblem,
  startClock,
  configureRealtime,
  publish: (id) => publish(String(id)),
};
