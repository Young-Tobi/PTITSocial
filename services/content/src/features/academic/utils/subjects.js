const AppError = require('@ptitsocial/service-kit/appError');
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
function tags(value = [], max = 5) {
  if (!Array.isArray(value) || value.length > max)
    throw new AppError('Danh sách thẻ vượt giới hạn cho phép.', 400);
  const normalized = value.map((tag) => {
    if (typeof tag !== 'string') throw new AppError('Thẻ chủ đề phải là văn bản.', 400);
    const result = tag.normalize('NFC').trim().toLowerCase();
    if (result.length < 2 || result.length > 30 || !/^[\p{L}\p{N} .+#_-]+$/u.test(result))
      throw new AppError('Thẻ cần có 2–30 ký tự, gồm chữ, số, khoảng trắng hoặc . + # _ -.', 400);
    return result;
  });
  return [...new Set(normalized)];
}
function interests(value) {
  if (
    !value ||
    !Array.isArray(value.subjects) ||
    value.subjects.length > 10 ||
    value.subjects.some((id) => !subjects.some((subject) => subject.id === id))
  )
    throw new AppError('Vui lòng chọn tối đa 10 môn học hợp lệ.', 400);
  return { subjects: [...new Set(value.subjects)], tags: tags(value.tags, 20) };
}
module.exports = { subjects, tags, interests };
