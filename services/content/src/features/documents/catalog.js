const subjects = [
  ['databases', 'Cơ sở dữ liệu'],
  ['web', 'Lập trình Web'],
  ['algorithms', 'Cấu trúc dữ liệu và Giải thuật'],
  ['oop', 'Lập trình hướng đối tượng'],
  ['networks', 'Mạng máy tính'],
  ['os', 'Hệ điều hành'],
  ['discrete-math', 'Toán rời rạc'],
  ['other', 'Khác'],
].map(([id, name]) => ({ id, name }));
const topics = [
  ['lecture', 'Bài giảng'],
  ['outline', 'Đề cương'],
  ['exercise', 'Bài tập'],
  ['exam', 'Đề thi/ôn tập'],
  ['reference', 'Tài liệu tham khảo'],
  ['other', 'Khác'],
].map(([id, name]) => ({ id, name }));
const reasons = [
  ['copyright', 'Không có quyền chia sẻ'],
  ['inappropriate', 'Nội dung không phù hợp'],
  ['unsafe', 'Tệp đáng ngờ'],
  ['incorrect', 'Sai thông tin'],
  ['other', 'Khác'],
].map(([id, name]) => ({ id, name }));
module.exports = { subjects, topics, reasons };
