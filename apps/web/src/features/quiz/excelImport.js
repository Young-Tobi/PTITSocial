import { IMPORT_HEADERS, parseSpreadsheetRows } from './importQuestions';

async function workbook() {
  // Browser bundle is loaded only when Excel import/template is requested.
  const module = await import('exceljs/dist/exceljs.min.js');
  const ExcelJS = module.default || module;
  return new ExcelJS.Workbook();
}
export async function readQuestionFile(file, defaultTime) {
  if (!/\.xlsx$/i.test(file.name)) throw Error('Vui lòng chọn file Excel .xlsx.');
  if (file.size > 2 * 1024 * 1024) throw Error('File tối đa 2 MB.');
  const book = await workbook();
  try {
    await book.xlsx.load(await file.arrayBuffer());
  } catch {
    throw Error('Không đọc được file. Hãy dùng file .xlsx hợp lệ, không đặt mật khẩu.');
  }
  const sheet = book.getWorksheet('Cau hoi') || book.worksheets[0];
  if (!sheet) throw Error('File chưa có sheet dữ liệu.');
  if (sheet.rowCount > 1001 || sheet.columnCount > 30)
    throw Error('Sheet quá lớn. Dùng file mẫu và chỉ giữ tối đa 100 câu hỏi.');
  const grid = [];
  for (let row = 1; row <= sheet.rowCount; row++) {
    const cells = [];
    for (let column = 1; column <= sheet.columnCount; column++) {
      const value = sheet.getCell(row, column).value;
      cells.push(value?.richText ? value.richText.map((part) => part.text).join('') : value);
    }
    grid.push(cells);
  }
  return parseSpreadsheetRows(grid, defaultTime);
}
export async function downloadQuestionTemplate() {
  const book = await workbook();
  const sheet = book.addWorksheet('Cau hoi');
  sheet.addRow(IMPORT_HEADERS);
  sheet.addRow([
    'HTML dùng để làm gì?',
    'Tạo cấu trúc trang web',
    'Quản lý cơ sở dữ liệu',
    'Chỉnh sửa ảnh',
    'Quản lý máy chủ',
    'A',
    20,
    'HTML mô tả cấu trúc nội dung trang web.',
  ]);
  sheet.addRow([
    'Những công nghệ nào thuộc MERN?',
    'MongoDB',
    'Express',
    'React',
    'Django',
    'A, B, C',
    30,
    'MERN gồm MongoDB, Express, React và Node.js.',
  ]);
  sheet.columns.forEach((column, index) => {
    column.width = [55, 28, 28, 28, 28, 18, 16, 60][index];
  });
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB8202E' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  const guide = book.addWorksheet('Huong dan');
  [
    'Điền câu hỏi ở sheet Cau hoi; dòng 1 là tiêu đề, mỗi dòng tiếp theo là một câu.',
    'Xóa hai câu mẫu trước khi nhập đề của bạn. Tối đa 100 câu hỏi.',
    'Đáp án đúng: A, B, C hoặc D. Nhiều đáp án đúng ghi A, B (phân cách dấu phẩy). Chọn đủ và không chọn thừa mới được điểm. Mỗi câu có đủ 4 đáp án khác nhau.',
    'Thời gian: số nguyên 5–180 giây. Bỏ trống để dùng thời gian mặc định khi nhập.',
    'Giải thích có thể để trống. Nhập văn bản/số trực tiếp, không dùng công thức.',
  ].forEach((text) => guide.addRow([text]));
  guide.getColumn(1).width = 120;
  const bytes = await book.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'PTITSocial-Mau-Quiz.xlsx';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
