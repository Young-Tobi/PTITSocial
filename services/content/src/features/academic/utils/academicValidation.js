const AppError = require('@ptitsocial/service-kit/appError');
const { subjects, tags } = require('./subjects');
function text(value, label, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max)
    throw new AppError(label + ' phải có từ ' + min + ' đến ' + max + ' ký tự.', 400);
  return value;
}
function id(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value))
    throw new AppError('Mã dữ liệu không hợp lệ.', 400);
  return value;
}
function pagination(query) {
  const number = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max)
      throw new AppError('Thông tin phân trang không hợp lệ.', 400);
    return Number(value);
  };
  return { page: number(query.page, 1, 100000), limit: number(query.limit, 20, 50) };
}
function question(body) {
  if (Object.prototype.hasOwnProperty.call(body, 'images'))
    throw new AppError('Câu hỏi không hỗ trợ đính kèm ảnh.', 400);
  let values = body.tags === undefined ? [] : body.tags;
  if (typeof values === 'string') {
    try {
      values = JSON.parse(values);
    } catch {
      throw new AppError('Danh sách thẻ không hợp lệ.', 400);
    }
  }
  if (!subjects.some((subject) => subject.id === body.subject))
    throw new AppError('Vui lòng chọn môn học.', 400);
  return {
    title: text(body.title, 'Tiêu đề', 10, 200).trim(),
    body: text(body.body, 'Nội dung', 20, 20000),
    subject: body.subject,
    tags: tags(values),
  };
}
function filters(query) {
  const filter = {};
  if (query.q !== undefined) filter.$text = { $search: text(query.q, 'Từ khóa', 1, 200).trim() };
  if (query.subject !== undefined) {
    if (!subjects.some((s) => s.id === query.subject))
      throw new AppError('Môn học không hợp lệ.', 400);
    filter.subject = query.subject;
  }
  if (query.tags !== undefined) {
    if (typeof query.tags !== 'string') throw new AppError('Thẻ lọc không hợp lệ.', 400);
    filter.tags = { $in: tags(query.tags.split(',')) };
  }
  if (query.status !== undefined) {
    if (!['resolved', 'unresolved'].includes(query.status))
      throw new AppError('Trạng thái không hợp lệ.', 400);
    filter.acceptedAnswer = query.status === 'resolved' ? { $ne: null } : null;
  }
  const date = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new AppError('Ngày lọc không hợp lệ.', 400);
    const day = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value)
      throw new AppError('Ngày lọc không hợp lệ.', 400);
    return new Date(day.getTime() - 7 * 3600000);
  };
  if (query.from !== undefined || query.to !== undefined) {
    filter.createdAt = {};
    if (query.from !== undefined) filter.createdAt.$gte = date(query.from);
    if (query.to !== undefined)
      filter.createdAt.$lt = new Date(date(query.to).getTime() + 86400000);
    if (
      filter.createdAt.$gte &&
      filter.createdAt.$lt &&
      filter.createdAt.$gte >= filter.createdAt.$lt
    )
      throw new AppError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.', 400);
  }
  return filter;
}
module.exports = { text, id, pagination, question, filters };
