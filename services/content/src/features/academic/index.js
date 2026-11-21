const mongoose = require('mongoose');
const notifications = require('./utils/academicNotifications');

module.exports = function registerAcademic(app) {
  app.use('/api/v1/academic', require('./routes'));
  mongoose.connection.once('open', () => notifications.startRetries());
};
