require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const { createApp, start } = require('@ptitsocial/service-kit/server');
const { protect, requireVerified } = require('@ptitsocial/service-kit/auth');
const catchAsync = require('@ptitsocial/service-kit/catchAsync');
const AppError = require('@ptitsocial/service-kit/appError');
const c = require('./controllers');
const app = createApp('coding');
const router = express.Router();
router.use(protect, requireVerified);
for (const name of ['roomId', 'submissionId'])
  router.param(name, (req, res, next, value) =>
    /^[a-f0-9]{24}$/i.test(value) ? next() : next(new AppError('ID không hợp lệ.', 400))
  );
router.get('/status', catchAsync(c.status));
router.get('/problems', catchAsync(c.problems));
router.get('/rooms', catchAsync(c.list));
router.post('/rooms', catchAsync(c.create));
router.post(
  '/rooms/join',
  rateLimit({ windowMs: 60000, max: 30, keyGenerator: (req) => req.user.id }),
  catchAsync(c.join)
);
router.get('/rooms/:roomId', catchAsync(c.state));
router.post(
  '/rooms/:roomId/join',
  rateLimit({ windowMs: 60000, max: 30, keyGenerator: (req) => req.user.id }),
  catchAsync(c.joinPublic)
);
for (const action of ['start', 'leave', 'end', 'kick'])
  router.post('/rooms/:roomId/' + action, catchAsync(c[action]));
router.post(
  '/rooms/:roomId/:mode(run|submit)',
  rateLimit({
    windowMs: 60000,
    max: 20,
    keyGenerator: (req) => req.user.id,
    message: { message: 'Tối đa 20 lần chạy/nộp mỗi phút.' },
  }),
  catchAsync(c.submit)
);
router.get('/submissions/:submissionId/code', catchAsync(c.code));
app.use('/api/v1/coding', router);
async function boot() {
  require('mongoose').set('strictQuery', false);
  await require('mongoose').connect(process.env.DATABASE);
  await Promise.all(Object.values(require('./models')).map((model) => model.init()));
  await require('./migrate').migrate();
  await require('./seed').seed();
  await start(app, {
    name: 'coding',
    port: Number(process.env.PORT || 8005),
    realtime: require('./realtime').init,
  });
  await require('./worker').startWorker();
  require('./engine').startClock();
}
boot().catch((error) => {
  console.error(error);
  process.exit(1);
});
