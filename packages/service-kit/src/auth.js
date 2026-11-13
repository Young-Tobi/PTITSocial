const { request } = require('./http');
const AppError = require('./appError');
const catchAsync = require('./catchAsync');

function tokenFrom(req) {
  return req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : req.cookies?.jwt;
}

async function authenticate(token) {
  if (!token) throw new AppError('Please log in to continue', 401);
  return (await request('accounts', '/internal/auth/verify', { method: 'POST', body: { token } }))
    .user;
}

const protect = catchAsync(async (req, res, next) => {
  req.user = await authenticate(tokenFrom(req));
  next();
});

function requireVerified(req, res, next) {
  if (!req.user.verified)
    return next(new AppError('Please verify your email before using PTITSocial', 403));
  next();
}

module.exports = { protect, requireVerified, authenticate, tokenFrom };
