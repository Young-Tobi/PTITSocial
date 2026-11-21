// Older saved quizzes/attempts have scalar fields; read them without a data migration.
export const correctAnswers = (question) =>
  Array.isArray(question?.correctIndices)
    ? question.correctIndices
    : Number.isInteger(question?.correctIndex)
      ? [question.correctIndex]
      : [];
export const selectedAnswers = (answer) =>
  Array.isArray(answer?.selectedIndices)
    ? answer.selectedIndices
    : Number.isInteger(answer?.selectedIndex)
      ? [answer.selectedIndex]
      : [];
