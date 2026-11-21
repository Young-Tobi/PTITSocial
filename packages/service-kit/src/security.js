const rateLimit = require('express-rate-limit');
const AppError = require('./appError');
const jwt = require('jsonwebtoken');

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
    if (key.startsWith('$') || key.includes('.') || key.includes('[') || key.includes(']'))
      return true;
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

function createRateLimiter({ max, message, windowMs = DEFAULT_WINDOW_MS, ...options }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: requestRateKey,
    message: { status: 'fail', message },
    ...options,
  });
}

function requestRateKey(req) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : req.cookies?.jwt;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (typeof decoded.id === 'string' && /^[a-f0-9]{24}$/i.test(decoded.id))
      return 'user:' + decoded.id;
  } catch {
    /* Anonymous or invalid sessions share the network limit. */
  }
  return 'ip:' + req.ip;
}

const apiRateLimiter = createRateLimiter({
  max: 600,
  message: 'Too many requests. Please try again later.',
  keyGenerator: requestRateKey,
});

module.exports = {
  apiRateLimiter,
  createRateLimiter,
  rejectUnsafeMongoKeys,
  securityHeaders,
  requestRateKey,
};
