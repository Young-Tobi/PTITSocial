const { createProxyMiddleware } = require('http-proxy-middleware');

// Both localhost and a forwarded port use the same origin for HTTP and WebSockets.
module.exports = function setupProxy(app) {
  app.use('/internal', (req, res) => res.status(404).json({ status: 'fail', message: 'Endpoint not found' }));
  app.use(createProxyMiddleware(
    ['/api', '/uploads', '/health', '/socket.io', '/quiz-socket', '/coding-socket'],
    { target: 'http://127.0.0.1:8000', changeOrigin: true, ws: true, logLevel: 'warn' }
  ));
};
