const Room = require('../models/Room');
const Attempt = require('../models/Attempt');
const AppError = require('@ptitsocial/service-kit/appError');
const { scoreAnswer, rankAttempts, correctAnswers, roomDurationMinutes } = require('./rules');
const { withRoomLock } = require('./locks');

let publish = () => {};
let online = () => false;
function configureRealtime(callbacks) {
  publish = callbacks.publish;
  online = callbacks.online;
}

async function loadRoom(roomId, userId, hostOnly = false) {
  const room = await Room.findById(roomId);
  if (!room) throw new AppError('Không tìm thấy phòng quiz.', 404);
  const host = room.host.id === userId;
  const attempt = host ? null : await Attempt.findOne({ roomId, userId, removed: false });
  if (!host && (!attempt || hostOnly))
    throw new AppError('Bạn không có quyền truy cập phòng này.', 403);
  return { room, attempt, host };
}

async function record(room, attempt, selectedIndex, now = Date.now()) {
  const question = room.questions[attempt.cursor];
  const outcome = scoreAnswer(
    question,
    selectedIndex,
    attempt.questionStartedAt,
    now,
    room.settings.speedBonus
  );
  attempt.answers.push({
    questionId: question.id,
    selectedIndex: outcome.timedOut
      ? null
      : Array.isArray(selectedIndex)
        ? selectedIndex.length === 1
          ? selectedIndex[0]
          : null
        : selectedIndex,
    selectedIndices:
      outcome.timedOut || selectedIndex === null
        ? []
        : Array.isArray(selectedIndex)
          ? selectedIndex
          : [selectedIndex],
    ...outcome,
    submittedAt: new Date(now),
  });
  attempt.score += outcome.points;
  attempt.correctCount += outcome.correct ? 1 : 0;
  attempt.streak = outcome.correct ? attempt.streak + 1 : 0;
  attempt.bestStreak = Math.max(attempt.bestStreak, attempt.streak);
  attempt.phase = 'feedback';
  if (attempt.answers.length === room.questions.length) attempt.completedAt = new Date(now);
  await attempt.save();
}

async function finish(room, reason, attempts, now = Date.now()) {
  room.status = 'finished';
  room.finishedAt = new Date(now);
  room.finishReason = reason;
  if (reason !== 'all_completed') {
    for (const attempt of attempts) {
      attempt.phase = 'completed';
      attempt.completedAt = new Date(now);
      await attempt.save();
    }
  }
  await room.save();
  publish(String(room._id));
}

// A player who explicitly leaves no longer keeps everyone else waiting.
async function finishIfEveryoneDone(room, attempts) {
  const everyoneDone =
    attempts.length > 0 &&
    attempts.every((attempt) => attempt.leftAt || attempt.answers.length === room.questions.length);
  if (!everyoneDone) return false;
  const reason = attempts.every((attempt) => attempt.leftAt) ? 'all_left' : 'all_completed';
  await finish(room, reason, attempts);
  return true;
}

async function refreshRoom(room) {
  const attempts = await Attempt.find({ roomId: room._id, removed: false }).sort('createdAt');
  if (room.status === 'finished') return attempts;
  const now = Date.now();
  if (now >= room.expiresAt.getTime()) {
    await finish(room, 'expired', attempts, now);
    return attempts;
  }
  if (room.status !== 'running') return attempts;
  let changed = false;
  for (const attempt of attempts) {
    if (!attempt.leftAt && attempt.phase === 'answering') {
      const question = room.questions[attempt.cursor];
      if (now >= attempt.questionStartedAt.getTime() + question.timeLimit * 1000) {
        await record(room, attempt, null, now);
        changed = true;
      }
    }
  }
  if (!(await finishIfEveryoneDone(room, attempts)) && changed) publish(String(room._id));
  return attempts;
}

function publicRoom(room) {
  return {
    id: String(room._id),
    title: room.title,
    subject: room.subject,
    host: { id: room.host.id, name: room.host.name, photo: room.host.photo },
    code: room.code,
    status: room.status,
    questionCount: room.questions.length,
    timeLimitMinutes: room.startedAt
      ? Math.round((room.expiresAt - room.startedAt) / 60000)
      : roomDurationMinutes(room.questions),
    settings: {
      maxPlayers: room.settings.maxPlayers,
      shuffleOptions: room.settings.shuffleOptions,
      speedBonus: room.settings.speedBonus,
    },
    startedAt: room.startedAt,
    finishedAt: room.finishedAt,
    finishReason: room.finishReason,
    expiresAt: room.expiresAt,
  };
}

function playerSummary(attempt, count) {
  return {
    userId: attempt.userId,
    name: attempt.name,
    photo: attempt.photo,
    answeredCount: attempt.answers.length,
    correctCount: attempt.correctCount,
    incorrectCount: attempt.answers.length - attempt.correctCount,
    score: attempt.score,
    phase: attempt.phase,
    completed: attempt.answers.length === count,
    leftAt: attempt.leftAt,
    online: online(String(attempt.roomId), attempt.userId),
  };
}

function packet(room, attempts, userId) {
  const host = room.host.id === userId;
  const own = attempts.find((attempt) => attempt.userId === userId);
  const data = {
    room: publicRoom(room),
    role: host ? 'host' : 'player',
    serverNow: Date.now(),
    players: attempts.map((attempt) => playerSummary(attempt, room.questions.length)),
    leaderboard: rankAttempts(attempts),
  };
  if (host) return data;
  if (!own) throw new AppError('Bạn không còn ở trong phòng này.', 403);
  data.attempt = {
    ...playerSummary(own, room.questions.length),
    cursor: own.cursor,
    streak: own.streak,
    bestStreak: own.bestStreak,
  };
  if (['answering', 'feedback'].includes(own.phase)) {
    const question = room.questions[own.cursor];
    data.question = {
      id: question.id,
      text: question.text,
      timeLimit: question.timeLimit,
      selectionMode: correctAnswers(question).length > 1 ? 'multiple' : 'single',
      options: own.optionOrders[own.cursor].map((index) => ({
        id: index,
        text: question.options[index],
      })),
      deadline: new Date(own.questionStartedAt.getTime() + question.timeLimit * 1000),
    };
    if (own.phase === 'feedback') {
      const answer = own.answers.find((answer) => answer.questionId === question.id);
      data.feedback = {
        ...answer.toObject(),
        correctIndex: question.correctIndex,
        correctIndices: correctAnswers(question),
        selectedIndices:
          answer.selectedIndices ?? (answer.selectedIndex === null ? [] : [answer.selectedIndex]),
        explanation: question.explanation,
      };
    }
  }
  return data;
}

async function roomState(roomId, userId) {
  return withRoomLock(roomId, async () => {
    const { room } = await loadRoom(roomId, userId);
    const attempts = await refreshRoom(room);
    return packet(room, attempts, userId);
  });
}

function startExpiryWorker() {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const rooms = await Room.find({ status: { $in: ['waiting', 'running'] } }).select('_id');
      for (const room of rooms)
        await withRoomLock(room._id, async () => {
          const current = await Room.findById(room._id);
          if (current) await refreshRoom(current);
        });
    } catch (error) {
      console.error('Quiz expiry worker:', error.message);
    } finally {
      busy = false;
    }
  }, 1000);
  timer.unref();
  return timer;
}

module.exports = {
  configureRealtime,
  loadRoom,
  record,
  finish,
  finishIfEveryoneDone,
  refreshRoom,
  packet,
  roomState,
  publicRoom,
  publishRoom: (id) => publish(String(id)),
  startExpiryWorker,
};
