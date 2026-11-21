const mongoose = require('mongoose');
const storage = require('./storage');
module.exports = (app) => {
  app.use('/api/v1/documents', require('./routes'));
  mongoose.connection.once('open', () => {
    let running = false;
    const cleanup = async () => {
      if (running) return;
      running = true;
      try {
        await storage.sweep();
      } catch (error) {
        console.error('Document cleanup failed:', error.message);
      } finally {
        running = false;
      }
    };
    cleanup();
    setInterval(cleanup, 30000).unref();
  });
};
