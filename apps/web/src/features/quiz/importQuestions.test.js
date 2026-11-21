import {
  parseQuestionText,
  parseSpreadsheetRows,
  mergeImportedQuestions,
  TEXT_SAMPLE,
  IMPORT_HEADERS,
} from './importQuestions';

test('parses multiple questions, correct answers and multiline content with default/individual times', () => {
  const rows = parseQuestionText(
    TEXT_SAMPLE + '\nThời gian: 45\nGiải thích: Dòng một\nDòng hai',
    25
  );
  expect(rows).toHaveLength(2);
  expect(rows.every((row) => row.errors.length === 0)).toBe(true);
  expect(rows[0].question).toMatchObject({ correctIndex: 0, timeLimit: 25 });
  expect(rows[1].question).toMatchObject({
    correctIndex: 1,
    timeLimit: 45,
    explanation: 'Dòng một\nDòng hai',
  });
  const numeric = parseQuestionText('1. Tính tổng\n2 + 2?\na) 1\nb) 2\nc) 3\nd) 4\nDap an: D');
  expect(numeric[0].question.text).toBe('Tính tổng\n2 + 2?');
  expect(numeric[0].question.correctIndex).toBe(3);
});
test('reports incomplete, ambiguous or invalid rows without silently importing them', () => {
  const rows = parseQuestionText(
    'Câu 1: Hỏi?\nA. Một\nA. Hai\nB. Hai\nC. Ba\nĐáp án: AB\nThời gian: 4'
  );
  expect(rows[0].errors.join(' ')).toMatch(/xuất hiện nhiều lần/);
  expect(rows[0].errors.join(' ')).toMatch(/Thiếu đáp án D/);
  expect(rows[0].errors.join(' ')).toMatch(/A, B, C/);
  expect(rows[0].errors.join(' ')).toMatch(/5 đến 180/);
  expect(() => parseQuestionText('Nội dung không có tiêu đề câu')).toThrow(/Dòng 1/);
  expect(() => parseQuestionText('')).toThrow(/Chưa có/);
  expect(() => parseQuestionText('a'.repeat(200001))).toThrow(/200.000/);
  expect(() =>
    parseQuestionText(
      Array.from({ length: 101 }, (_, index) => `Câu ${index + 1}: Hỏi?`).join('\n')
    )
  ).toThrow(/100/);
});
test('spreadsheet checks columns, preserves row numbers and rejects formulas', () => {
  const rows = parseSpreadsheetRows(
    [IMPORT_HEADERS, [], ['Hỏi?', 'ma', 'má', 'mà', 'mạ', 'b', '', 'Giải thích']],
    35
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].source).toBe('Dòng Excel 3');
  expect(rows[0].errors).toEqual([]);
  expect(rows[0].question).toMatchObject({ correctIndex: 1, timeLimit: 35 });
  expect(() => parseSpreadsheetRows([['Sai mẫu']])).toThrow(/Thiếu cột/);
  expect(() => parseSpreadsheetRows([[...IMPORT_HEADERS, 'A']])).toThrow(/trùng/);
  const formula = parseSpreadsheetRows([
    IMPORT_HEADERS,
    ['Hỏi?', { formula: '1+1', result: 2 }, '2', '3', '4', 'A'],
  ]);
  expect(formula[0].errors.join(' ')).toMatch(/công thức/);
});
test('text and Excel accept multiple correct answers, with no duplicates or malformed separators', () => {
  const multiple = TEXT_SAMPLE.replace('Đáp án: A', 'Đáp án: B, A');
  expect(parseQuestionText(multiple)[0].question.correctIndices).toEqual([0, 1]);
  expect(parseQuestionText(multiple)[0].errors).toEqual([]);
  const rows = parseSpreadsheetRows([IMPORT_HEADERS, ['Hỏi?', '1', '2', '3', '4', 'A; C']]);
  expect(rows[0].question.correctIndices).toEqual([0, 2]);
  for (const answer of ['A,A', 'A,,B', 'A,E', 'AB']) {
    expect(
      parseSpreadsheetRows([IMPORT_HEADERS, ['Hỏi?', '1', '2', '3', '4', answer]])[0].errors.length
    ).toBeGreaterThan(0);
  }
});
test('confirmed import preserves existing edits, replaces only empty starter and enforces total limit', () => {
  const imported = parseQuestionText(TEXT_SAMPLE).map((row) => row.question);
  const starter = { text: '', options: ['', '', '', ''], explanation: '' };
  const merged = mergeImportedQuestions([starter], imported, () => 'new-id');
  expect(merged.questions).toHaveLength(2);
  expect(merged.active).toBe(0);
  const existing = { id: 'old', ...imported[0] };
  const appended = mergeImportedQuestions([existing], imported, () => 'another-id');
  expect(appended.questions[0]).toBe(existing);
  expect(appended.active).toBe(1);
  expect(appended.questions[1].id).toBe('another-id');
  expect(() => mergeImportedQuestions(Array(99).fill(existing), imported)).toThrow(/100/);
  expect(
    mergeImportedQuestions([{ ...starter, explanation: 'Ghi chú' }], imported, () => 'new-id')
      .questions
  ).toHaveLength(3);
});
