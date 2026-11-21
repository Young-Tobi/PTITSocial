// Scoped to academic endpoints; existing features keep their error handling.
module.exports = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.isOperational ? err.message : 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
  if (['ValidationError', 'CastError'].includes(err.name)) {
    status = 400;
    message = 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.';
  }
  if (status === 401) message = 'Vui lòng đăng nhập để tiếp tục.';
  if (status === 403 && req.user && !req.user.verified)
    message = 'Vui lòng xác minh email trước khi sử dụng Hỏi đáp học thuật.';
  if (status === 403 && !err.isOperational) message = 'Bạn không có quyền thực hiện thao tác này.';
  if (status >= 500) console.error('Academic request failed:', err.message);
  res.status(status).json({ status: 'error', message });
};
