require('dotenv').config();
const { createApp, start } = require('@ptitsocial/service-kit/server');
const auth = require('@ptitsocial/service-kit/auth');
const User = require('./models/userModel');
require('./models/focusRoomModel');
require('./models/focusRoomParticipantModel');
require('./models/focusRoomMessageModel');
require('./models/studyLocationModel');
require('./models/studyLocationReviewModel');
require('./models/studyMeetupModel');
require('./models/studyMeetupRegistrationModel');
const sync = require('@ptitsocial/service-kit/projections').projectionSync({ User });
const realtime = require('./utils/socket');

const app = createApp('study');
app.use('/api', auth.protect, auth.requireVerified, sync.middleware);
app.use((req, res, next) => {
  req.studyIO = realtime.getIO();
  next();
});
app.use('/api/v1/study/focus-rooms', require('./routes/focusRoomRoutes'));
app.use('/api/v1/study', require('./routes/studySpotRoutes'));

start(app, {
  name: 'study',
  port: Number(process.env.PORT || 8004),
  realtime: realtime.init,
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
