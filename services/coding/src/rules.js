const AppError = require('@ptitsocial/service-kit/appError');
function roomSettings(body) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > 100) throw new AppError('Tên phòng cần từ 1 đến 100 ký tự.', 400);
  const durationMinutes = Number(body.durationMinutes ?? 45),
    maxPlayers = Number(body.maxPlayers ?? 8);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 180)
    throw new AppError('Thời lượng cần từ 5 đến 180 phút.', 400);
  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 30)
    throw new AppError('Số người thi cần từ 2 đến 30.', 400);
  const visibility = body.visibility ?? 'public';
  if (!['public', 'private'].includes(visibility))
    throw new AppError('Quyền truy cập không hợp lệ.', 400);
  const problemIds = body.problemIds;
  if (
    !Array.isArray(problemIds) ||
    problemIds.length < 1 ||
    problemIds.length > 20 ||
    problemIds.some((id) => typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id)) ||
    new Set(problemIds.map((id) => id.toLowerCase())).size !== problemIds.length
  )
    throw new AppError('Chọn từ 1 đến 20 đề khác nhau từ kho đề.', 400);
  return {
    title,
    durationMinutes,
    maxPlayers,
    visibility,
    problemIds: problemIds.map((id) => id.toLowerCase()),
  };
}
const problemId = (problem) => String(problem._id);
const pointsFor = (passed, total) => (total > 0 ? Math.round((passed / total) * 10000) / 100 : 0);
function canImprove(score, passed, receivedAt) {
  return !score
    ? passed > 0
    : passed > score.passed || (passed === score.passed && passed > 0 && receivedAt < score.bestAt);
}
function playerScores(room, player) {
  return room.problems.map((problem) => {
    const id = problemId(problem),
      score = player.scores?.find((item) => item.problemId === id),
      total = problem.tests.length;
    return {
      problemId: id,
      passed: score?.passed || 0,
      total,
      points: pointsFor(score?.passed || 0, total),
      solved: score?.passed === total && total > 0,
      bestAt: score?.bestAt || null,
    };
  });
}
function solvedAll(room, player) {
  return room.problems.length > 0 && playerScores(room, player).every((score) => score.solved);
}
function leaderboard(room) {
  const rows = room.players.map((player) => {
    const scores = playerScores(room, player),
      dates = scores.filter((score) => score.points > 0).map((score) => +new Date(score.bestAt));
    const achievedAt = dates.length ? Math.max(...dates) : null;
    return {
      userId: player.userId,
      name: player.name,
      photo: player.photo,
      left: !!player.leftAt,
      scores,
      points: Math.round(scores.reduce((sum, score) => sum + score.points, 0) * 100) / 100,
      solvedCount: scores.filter((score) => score.solved).length,
      achievedAt,
      elapsedSeconds:
        achievedAt && room.startedAt
          ? Math.max(0, Math.floor((achievedAt - room.startedAt) / 1000))
          : null,
    };
  });
  rows.sort(
    (a, b) =>
      b.points - a.points ||
      (a.achievedAt ?? Infinity) - (b.achievedAt ?? Infinity) ||
      a.userId.localeCompare(b.userId)
  );
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}
module.exports = {
  roomSettings,
  problemId,
  pointsFor,
  canImprove,
  playerScores,
  solvedAll,
  leaderboard,
};
