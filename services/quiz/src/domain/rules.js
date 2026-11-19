const { randomUUID, randomInt } = require('node:crypto');
const AppError = require('@ptitsocial/service-kit/appError');

function fail(message) {
  throw new AppError(message, 400);
}
function text(value, max, label) {
  if (value !== undefined && typeof value !== 'string') fail(`${label} không hợp lệ.`);
  const result = (value || '').trim();
  if (result.length > max) fail(`${label} vượt quá ${max} ký tự.`);
  return result;
}

function correctAnswers(question) {
  return Array.isArray(question.correctIndices)
    ? [...question.correctIndices]
    : Number.isInteger(question.correctIndex)
      ? [question.correctIndex]
      : [];
}

function validateSelection(selection) {
  return (
    Array.isArray(selection) &&
    selection.length >= 1 &&
    selection.length <= 4 &&
    selection.every((index) => Number.isInteger(index) && index >= 0 && index < 4) &&
    new Set(selection).size === selection.length
  );
}

function normalizeQuiz(input) {
  const title = text(input.title, 120, 'Tên bộ đề');
  if (!title) fail('Vui lòng nhập tên bộ đề.');
  const status = input.status === undefined ? 'draft' : input.status;
  if (!['draft', 'ready'].includes(status)) fail('Trạng thái bộ đề không hợp lệ.');
  const visibility = input.visibility || 'private';
  if (!['private', 'public'].includes(visibility)) fail('Quyền hiển thị không hợp lệ.');
  if (!Array.isArray(input.questions) || input.questions.length > 100)
    fail('Bộ đề tối đa 100 câu hỏi.');
  const ids = new Set();
  const questions = input.questions.map((question, index) => {
    if (!question || typeof question !== 'object') fail(`Câu ${index + 1} không hợp lệ.`);
    const id =
      typeof question.id === 'string' && /^[\w-]{1,80}$/.test(question.id)
        ? question.id
        : randomUUID();
    if (ids.has(id)) fail('ID câu hỏi bị trùng.');
    ids.add(id);
    if (!Array.isArray(question.options) || question.options.length !== 4)
      fail(`Câu ${index + 1} cần đúng 4 lựa chọn.`);
    if (question.correctIndices !== undefined && !Array.isArray(question.correctIndices))
      fail(`Danh sách đáp án đúng của câu ${index + 1} không hợp lệ.`);
    const normalized = {
      id,
      text: text(question.text, 2000, `Nội dung câu ${index + 1}`),
      options: question.options.map((option) => text(option, 500, 'Đáp án')),
      correctIndices: correctAnswers(question),
      timeLimit: Number(question.timeLimit),
      explanation: text(question.explanation, 2000, 'Giải thích'),
    };
    if (
      !(status === 'draft' && normalized.correctIndices.length === 0) &&
      !validateSelection(normalized.correctIndices)
    )
      fail(`Chọn đáp án đúng cho câu ${index + 1}.`);
    normalized.correctIndices.sort((a, b) => a - b);
    normalized.correctIndex = normalized.correctIndices[0] ?? null;
    if (
      !Number.isInteger(normalized.timeLimit) ||
      normalized.timeLimit < 5 ||
      normalized.timeLimit > 180
    )
      fail('Thời gian mỗi câu từ 5 đến 180 giây.');
    if (status === 'ready') {
      if (!normalized.text || normalized.options.some((option) => !option))
        fail(`Hoàn thiện nội dung và 4 đáp án của câu ${index + 1}.`);
      if (new Set(normalized.options.map((option) => option.toLocaleLowerCase('vi'))).size !== 4)
        fail(`Các đáp án của câu ${index + 1} không được trùng nhau.`);
    }
    return normalized;
  });
  if (status === 'ready' && !questions.length) fail('Cần ít nhất một câu hỏi để hoàn tất bộ đề.');
  return {
    title,
    description: text(input.description, 1000, 'Mô tả'),
    subject: text(input.subject, 80, 'Môn học'),
    status,
    visibility,
    questions,
  };
}

function scoreAnswer(question, selectedIndex, startedAt, now, speedBonus = true) {
  const elapsedMs = Math.max(0, now - new Date(startedAt).getTime());
  const limitMs = question.timeLimit * 1000;
  const timedOut = elapsedMs >= limitMs;
  const selected = Array.isArray(selectedIndex)
    ? selectedIndex
    : selectedIndex === null
      ? []
      : [selectedIndex];
  const expected = correctAnswers(question);
  const correct =
    !timedOut &&
    validateSelection(selected) &&
    selected.length === expected.length &&
    expected.every((index) => selected.includes(index));
  const speedPoints =
    correct && speedBonus ? Math.max(0, Math.round(300 * (1 - elapsedMs / limitMs))) : 0;
  return { correct, points: correct ? 700 + speedPoints : 0, speedPoints, elapsedMs, timedOut };
}

function shuffledOptions(enabled) {
  const order = [0, 1, 2, 3];
  if (enabled)
    for (let index = 3; index > 0; index--) {
      const other = randomInt(index + 1);
      [order[index], order[other]] = [order[other], order[index]];
    }
  return order;
}

// Allow answer time, 30 seconds of feedback per question, plus 15 minutes spare.
function roomDurationMinutes(questions) {
  const seconds = questions.reduce((total, question) => total + question.timeLimit + 30, 0);
  return Math.max(90, Math.ceil(seconds / 60) + 15);
}

function rankAttempts(attempts) {
  const sorted = [...attempts].sort(
    (a, b) => b.score - a.score || String(a.userId).localeCompare(String(b.userId))
  );
  let previousScore,
    rank = 0;
  return sorted.map((attempt, index) => {
    if (attempt.score !== previousScore) rank = index + 1;
    previousScore = attempt.score;
    return {
      userId: attempt.userId,
      name: attempt.name,
      photo: attempt.photo,
      score: attempt.score,
      rank,
      correctCount: attempt.correctCount,
      answeredCount: attempt.answers.length,
      left: Boolean(attempt.leftAt),
    };
  });
}

module.exports = {
  normalizeQuiz,
  scoreAnswer,
  shuffledOptions,
  rankAttempts,
  correctAnswers,
  validateSelection,
  roomDurationMinutes,
};
