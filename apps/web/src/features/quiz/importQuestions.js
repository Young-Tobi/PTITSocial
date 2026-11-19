export const IMPORT_HEADERS = [
  'Câu hỏi',
  'A',
  'B',
  'C',
  'D',
  'Đáp án đúng',
  'Thời gian',
  'Giải thích',
];
export const TEXT_SAMPLE = `Câu 1: HTML dùng để làm gì?
A. Tạo cấu trúc trang web
B. Quản lý cơ sở dữ liệu
C. Chỉnh sửa ảnh
D. Quản lý máy chủ
Đáp án: A
Giải thích: HTML mô tả cấu trúc nội dung trang web.

Câu 2: React Hook nào quản lý state?
A. useEffect
B. useState
C. useRef
D. useMemo
Đáp án: B`;

const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .toLowerCase();

// Parsing never creates IDs or changes the editor. Only confirmed, validated rows are imported.
export function validateImportedRows(rows, defaultTime = 20) {
  return rows.map((row) => {
    const errors = [...(row.errors || [])];
    const text = String(row.text ?? '').trim();
    const options = Array.from({ length: 4 }, (_, index) =>
      String(row.options?.[index] ?? '').trim()
    );
    const answer = String(row.answer ?? '')
      .trim()
      .toUpperCase();
    const validAnswer = /^[ABCD](?:\s*[,;]\s*[ABCD])*$/.test(answer);
    const correctIndices = validAnswer
      ? answer
          .split(/\s*[,;]\s*/)
          .map((letter) => 'ABCD'.indexOf(letter))
          .sort((a, b) => a - b)
      : [];
    const explanation = String(row.explanation ?? '').trim();
    const timeLimit =
      row.timeLimit === undefined || String(row.timeLimit).trim() === ''
        ? Number(defaultTime)
        : Number(row.timeLimit);
    if (!text) errors.push('Thiếu nội dung câu hỏi.');
    if (text.length > 2000) errors.push('Nội dung vượt 2.000 ký tự.');
    options.forEach((option, index) => {
      if (!option) errors.push(`Thiếu đáp án ${'ABCD'[index]}.`);
      if (option.length > 500) errors.push(`Đáp án ${'ABCD'[index]} vượt 500 ký tự.`);
    });
    if (
      options.every(Boolean) &&
      new Set(options.map((option) => option.toLocaleLowerCase('vi'))).size !== 4
    )
      errors.push('Các đáp án bị trùng nhau.');
    if (!validAnswer || new Set(correctIndices).size !== correctIndices.length)
      errors.push('Đáp án đúng phải là A, B, C hoặc D; nhiều đáp án ghi A, B và không được trùng.');
    if (!Number.isInteger(timeLimit) || timeLimit < 5 || timeLimit > 180)
      errors.push('Thời gian phải là số nguyên từ 5 đến 180 giây.');
    if (explanation.length > 2000) errors.push('Giải thích vượt 2.000 ký tự.');
    return {
      source: row.source,
      question: {
        text,
        options,
        correctIndex: correctIndices[0] ?? null,
        correctIndices: correctIndices.sort((a, b) => a - b),
        timeLimit,
        explanation,
      },
      errors,
    };
  });
}

export function parseQuestionText(input, defaultTime = 20) {
  if (input.length > 200000) throw Error('Nội dung tối đa 200.000 ký tự.');
  const rows = [];
  let current, section;
  const lines = input
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const heading = line.match(/^(?:(?:câu|cau|question)\s*\d+\s*[:.)-]|\d+\s*[.)])\s*(.*)$/i);
    if (heading) {
      current = {
        source: `Dòng ${index + 1}`,
        text: heading[1],
        options: ['', '', '', ''],
        answer: '',
        explanation: '',
        errors: [],
        seen: new Set(),
      };
      rows.push(current);
      section = 'text';
      return;
    }
    if (!current) throw Error(`Dòng ${index + 1}: bắt đầu câu hỏi bằng “Câu 1: ...”.`);
    const option = line.match(/^([A-D])[.):]\s*(.*)$/i);
    if (option) {
      const position = 'ABCD'.indexOf(option[1].toUpperCase());
      if (current.seen.has(position))
        current.errors.push(`Đáp án ${'ABCD'[position]} xuất hiện nhiều lần.`);
      current.seen.add(position);
      current.options[position] = option[2];
      section = position;
      return;
    }
    const meta = line.match(/^([^:]+):\s*(.*)$/);
    const key = meta && normalize(meta[1]);
    const field = {
      'dap an': 'answer',
      'dap an dung': 'answer',
      answer: 'answer',
      'giai thich': 'explanation',
      explanation: 'explanation',
      'thoi gian': 'timeLimit',
      time: 'timeLimit',
    }[key];
    if (field) {
      if (current.seen.has(field)) current.errors.push(`Mục “${meta[1]}” xuất hiện nhiều lần.`);
      current.seen.add(field);
      current[field] = meta[2];
      section = field;
      return;
    }
    if (typeof section === 'number') current.options[section] += '\n' + line;
    else if (section === 'text' || section === 'explanation') current[section] += '\n' + line;
    else current.errors.push(`Dòng ${index + 1}: nội dung không đúng mẫu.`);
  });
  if (!rows.length) throw Error('Chưa có câu hỏi. Hãy dán đề theo mẫu bên dưới.');
  if (rows.length > 100) throw Error('Mỗi lần nhập tối đa 100 câu hỏi.');
  return validateImportedRows(rows, defaultTime);
}

export function parseSpreadsheetRows(grid, defaultTime = 20) {
  if (!grid.length) throw Error('Sheet chưa có dữ liệu.');
  const aliases = ['cau hoi', 'a', 'b', 'c', 'd', 'dap an dung', 'thoi gian', 'giai thich'];
  const headers = grid[0].map(normalize);
  const columns = aliases.map((name) => headers.indexOf(name));
  if (columns.slice(0, 6).some((index) => index === -1))
    throw Error('Thiếu cột bắt buộc. Dùng file mẫu có các cột: Câu hỏi, A, B, C, D, Đáp án đúng.');
  if (aliases.some((name) => headers.filter((header) => header === name).length > 1))
    throw Error('Tên cột bị trùng. Mỗi cột trong mẫu chỉ xuất hiện một lần.');
  const rows = [];
  grid.slice(1).forEach((cells, index) => {
    if (!cells.some((cell) => cell !== null && cell !== undefined && cell !== '')) return;
    const values = columns.map((column) => (column === -1 ? '' : cells[column]));
    const errors = [];
    values.forEach((value) => {
      if (value !== null && typeof value === 'object')
        errors.push(
          'Không hỗ trợ công thức, ngày tháng hoặc dữ liệu đặc biệt; hãy nhập giá trị văn bản/số.'
        );
    });
    const clean = values.map((value) =>
      value !== null && typeof value === 'object' ? '' : (value ?? '')
    );
    rows.push({
      source: `Dòng Excel ${index + 2}`,
      text: clean[0],
      options: clean.slice(1, 5),
      answer: clean[5],
      timeLimit: clean[6],
      explanation: clean[7],
      errors: [...new Set(errors)],
    });
  });
  if (!rows.length) throw Error('File chưa có câu hỏi bên dưới dòng tiêu đề.');
  if (rows.length > 100) throw Error('File chỉ được chứa tối đa 100 câu hỏi.');
  return validateImportedRows(rows, defaultTime);
}

export function mergeImportedQuestions(existing, imported, makeId = () => crypto.randomUUID()) {
  const blank =
    existing.length === 1 &&
    !existing[0].text.trim() &&
    existing[0].options.every((option) => !option.trim()) &&
    !existing[0].explanation.trim();
  const kept = blank ? [] : existing;
  if (kept.length + imported.length > 100)
    throw Error(
      `Bộ đề chỉ chứa tối đa 100 câu. Hiện có ${kept.length} câu, đang nhập thêm ${imported.length} câu.`
    );
  return {
    questions: [
      ...kept,
      ...imported.map((question) => ({
        ...question,
        options: [...question.options],
        id: makeId(),
      })),
    ],
    active: kept.length,
  };
}
