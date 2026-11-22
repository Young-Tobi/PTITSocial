const AppError = require('@ptitsocial/service-kit/appError');
const { subjects, topics } = require('./catalog');
const bad = (message) => {
  throw new AppError(message, 400);
};
function text(value, label, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max)
    bad(`${label} phải có từ ${min} đến ${max} ký tự.`);
  return value.trim();
}
function choice(value, choices, label) {
  if (!choices.some((item) => item.id === value)) bad(`${label} không hợp lệ.`);
  return value;
}
function metadata(body) {
  let keywords = body.keywords || [];
  if (typeof keywords === 'string') {
    try {
      keywords = JSON.parse(keywords);
    } catch {
      bad('Từ khóa không hợp lệ.');
    }
  }
  if (!Array.isArray(keywords) || keywords.length > 5) bad('Chọn tối đa 5 từ khóa.');
  keywords = keywords.map((value) => text(value, 'Từ khóa', 2, 30).normalize('NFC').toLowerCase());
  if (keywords.some((value) => !/^[\p{L}\p{N} .+#_-]+$/u.test(value)))
    bad('Từ khóa chứa ký tự không hợp lệ.');
  return {
    title: text(body.title, 'Tên tài liệu', 5, 200),
    description: text(body.description, 'Mô tả', 20, 5000),
    subject: choice(body.subject, subjects, 'Môn học'),
    topic: choice(body.topic, topics, 'Chủ đề'),
    keywords: [...new Set(keywords)],
    source: text(body.source ?? '', 'Nguồn/tác giả', 0, 1000),
  };
}
function id(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) bad('Mã tài liệu không hợp lệ.');
  return value;
}
function page(query) {
  if (
    query.page !== undefined &&
    (typeof query.page !== 'string' || !/^[1-9]\d{0,4}$/.test(query.page))
  )
    bad('Trang không hợp lệ.');
  return { page: Number(query.page || 1), limit: 20 };
}
function filters(query) {
  const filter = {};
  if (query.q) filter.$text = { $search: text(query.q, 'Từ tìm kiếm', 1, 200) };
  if (query.subject) filter.subject = choice(query.subject, subjects, 'Môn học');
  if (query.topic) filter.topic = choice(query.topic, topics, 'Chủ đề');
  if (query.format) {
    const format = choice(
      query.format,
      ['pdf', 'docx', 'pptx'].map((id) => ({ id })),
      'Định dạng'
    );
    filter.$or = [{ format }, { 'additionalFiles.format': format }];
  }
  function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) bad('Ngày không hợp lệ.');
    const parsed = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== value)
      bad('Ngày không hợp lệ.');
    return new Date(+parsed - 7 * 3600000);
  }
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = date(query.from);
    if (query.to) filter.createdAt.$lt = new Date(+date(query.to) + 86400000);
    if (filter.createdAt.$gte >= filter.createdAt.$lt) bad('Khoảng ngày không hợp lệ.');
  }
  if (query.sort && !['newest', 'oldest', 'helpful'].includes(query.sort))
    bad('Cách sắp xếp không hợp lệ.');
  return filter;
}
module.exports = { text, choice, metadata, id, page, filters, bad };
