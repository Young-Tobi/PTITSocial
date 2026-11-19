const rateLimit = require('express-rate-limit');
const AppError = require('./appError');

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

function securityHeaders(req, res, next) {
  // Cac header nay phu hop voi API JSON va khong anh huong den CORS hop le.
  res.set({
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
  });
  next();
}

function containsUnsafeMongoKey(value, visited = new WeakSet()) {
  if (!value || typeof value !== 'object' || Buffer.isBuffer(value)) return false;
  if (visited.has(value)) return false;
  visited.add(value);

  return Object.entries(value).some(([key, child]) => {
    if (key.startsWith('$') || key.includes('.')) return true;
    return containsUnsafeMongoKey(child, visited);
  });
}

function rejectUnsafeMongoKeys(req, res, next) {
  // Chan NoSQL operator injection truoc khi du lieu di vao Mongoose.
  if (
    containsUnsafeMongoKey(req.body) ||
    containsUnsafeMongoKey(req.query) ||
    containsUnsafeMongoKey(req.params)
  ) {
    return next(new AppError('Request contains unsupported field names', 400));
  }
  next();
}

function createRateLimiter({ max, message, windowMs = DEFAULT_WINDOW_MS }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'fail', message },
  });
}

const apiRateLimiter = createRateLimiter({
  max: 600,
  message: 'Too many requests. Please try again later.',
});

module.exports = {
  apiRateLimiter,
  createRateLimiter,
  rejectUnsafeMongoKeys,
  securityHeaders,
};
