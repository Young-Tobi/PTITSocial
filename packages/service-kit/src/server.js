const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const { createServer } = require('node:http');
const errorHandler = require('./errorHandler');
const AppError = require('./appError');
const { apiRateLimiter, rejectUnsafeMongoKeys, securityHeaders } = require('./security');

const origins = ['http://localhost:3000', 'http://127.0.0.1:3000'];

function createApp(name) {
  const app = express();
  app.set('trust proxy', 1);
  app.set('query parser', 'simple');
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(cors({ origin: origins, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());
  app.use('/api', apiRateLimiter, rejectUnsafeMongoKeys);
  app.get('/health', (req, res) =>
    res
      .status(mongoose.connection.readyState === 1 ? 200 : 503)
      .json({ service: name, status: mongoose.connection.readyState === 1 ? 'ok' : 'unavailable' })
  );
  return app;
}

async function start(app, { name, port, realtime } = {}) {
  app.all('*', (req, res, next) => next(new AppError('Endpoint not found', 404)));
  app.use(errorHandler);
  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.DATABASE);
  const server = createServer(app);
  if (realtime) realtime(server, { cors: { origin: origins, credentials: true } });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  console.log(`${name} ready at http://127.0.0.1:${port}`);
  const close = () => server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
  process.on('SIGTERM', close);
  process.on('SIGINT', close);
  return server;
}

module.exports = { createApp, start };
