require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const { createApp, start } = require('@ptitsocial/service-kit/server');
const { protect, requireVerified } = require('@ptitsocial/service-kit/auth');
const catchAsync = require('@ptitsocial/service-kit/catchAsync');
const AppError = require('@ptitsocial/service-kit/appError');
const Quiz = require('./models/Quiz');
const Room = require('./models/Room');
const Attempt = require('./models/Attempt');
const quizzes = require('./controllers/quizzes');
const rooms = require('./controllers/rooms');
const app = createApp('quiz');
const router = express.Router();
router.use(protect, requireVerified);
for (const name of ['quizId', 'roomId'])
  router.param(name, (req, res, next, value) => {
    if (!/^[a-f0-9]{24}$/i.test(value)) return next(new AppError('ID không hợp lệ.', 400));
    next();
  });
router.get('/quizzes', catchAsync(quizzes.list));
router.post('/quizzes', catchAsync(quizzes.create));
router.get('/quizzes/:quizId', catchAsync(quizzes.get));
router.put('/quizzes/:quizId', catchAsync(quizzes.update));
router.delete('/quizzes/:quizId', catchAsync(quizzes.remove));
router.get('/history', catchAsync(rooms.history));
router.post(
  '/rooms',
  catchAsync(async (req, res) => {
    if (!/^[a-f0-9]{24}$/i.test(String(req.body.quizId)))
      throw new AppError('Vui lòng chọn bộ đề hợp lệ.', 400);
    await rooms.create(req, res);
  })
);
router.post(
  '/rooms/join',
  rateLimit({
    windowMs: 60000,
    max: 30,
    keyGenerator: (req) => req.user.id,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 'fail',
      message: 'Bạn nhập mã quá nhiều lần. Vui lòng thử lại sau một phút.',
    },
  }),
  catchAsync(rooms.join)
);
router.get('/rooms/:roomId', catchAsync(rooms.state));
router.post('/rooms/:roomId/start', catchAsync(rooms.start));
router.post('/rooms/:roomId/answer', catchAsync(rooms.answer));
router.post('/rooms/:roomId/next', catchAsync(rooms.next));
router.post('/rooms/:roomId/end', catchAsync(rooms.end));
router.post('/rooms/:roomId/leave', catchAsync(rooms.leave));
router.delete('/rooms/:roomId/players/:userId', catchAsync(rooms.kick));
router.get('/rooms/:roomId/results', catchAsync(rooms.results));
app.use('/api/v1/quiz', router);

start(app, {
  name: 'quiz',
  port: Number(process.env.PORT || 8004),
  realtime: require('./realtime').init,
})
  .then(async () => {
    await Promise.all([Quiz.init(), Room.init(), Attempt.init()]);
    require('./domain/roomEngine').startExpiryWorker();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
