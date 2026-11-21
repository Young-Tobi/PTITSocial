// One local draft per account and quiz. This does not publish changes to the server.
export function draftKey(userId, quizId) {
  return `ptitsocial.quiz.draft.${userId}.${quizId || 'new'}`;
}

export function readDraft(key) {
  try {
    const quiz = JSON.parse(localStorage.getItem(key));
    if (
      !quiz ||
      typeof quiz.title !== 'string' ||
      !Array.isArray(quiz.questions) ||
      quiz.questions.length > 100
    )
      return null;
    const valid = quiz.questions.every(
      (question) =>
        question &&
        typeof question.id === 'string' &&
        typeof question.text === 'string' &&
        typeof question.explanation === 'string' &&
        Array.isArray(question.options) &&
        question.options.length === 4 &&
        question.options.every((option) => typeof option === 'string')
    );
    return valid ? quiz : null;
  } catch {
    return null;
  }
}

export function writeDraft(key, quiz) {
  localStorage.setItem(key, JSON.stringify(quiz));
}

export function clearDraft(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    /* Saving to the server still succeeded. */
    return false;
  }
}
