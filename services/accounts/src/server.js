require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { createApp, start } = require('@ptitsocial/service-kit/server');
const { internalOnly } = require('@ptitsocial/service-kit/http');
const catchAsync = require('@ptitsocial/service-kit/catchAsync');
const AppError = require('@ptitsocial/service-kit/appError');
const User = require('./models/userModel');
const Follow = require('./models/followModel');
require('./models/friendsModel');

const app = createApp('accounts');
app.use('/internal', internalOnly);
app.get(
  '/internal/projections',
  catchAsync(async (req, res) => {
    const users = await User.find()
      .select('_id first_name last_name username photo cover gender confirmed verified')
      .lean();
    const follows = await Follow.find().select('_id sender recipient').lean();
    res.json({ users, follows });
  })
);
app.post(
  '/internal/auth/verify',
  catchAsync(async (req, res, next) => {
    let decoded;
    try {
      decoded = jwt.verify(req.body.token, process.env.JWT_SECRET);
    } catch {
      return next(new AppError('Invalid or expired session', 401));
    }
    const user = await User.findById(decoded.id).select('+passwordChangedAt');
    if (!user || user.changedPasswordAfter(decoded.iat))
      return next(new AppError('Please log in again', 401));
    res.json({ user: { ...user.toObject(), id: user.id } });
  })
);
app.use('/api/v1/users', require('./routes/userRoutes'));
app.use('/api/v1/friends', require('./routes/friendsRoutes'));

start(app, { name: 'accounts', port: Number(process.env.PORT || 8001) }).catch((err) => {
  console.error(err);
  process.exit(1);
});
