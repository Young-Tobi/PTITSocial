const { Server } = require('socket.io');
const { authenticate } = require('@ptitsocial/service-kit/auth');
const engine = require('./domain/roomEngine');
const members = new Map();
let io;

function init(server, options) {
  io = new Server(server, { ...options, path: '/quiz-socket' });
  engine.configureRealtime({
    publish: (roomId) => io.to(`quiz:${roomId}`).emit('room:updated', { roomId }),
    online: (roomId, userId) => Boolean(members.get(`${roomId}:${userId}`)?.size),
  });
  io.use(async (socket, next) => {
    try {
      const cookie = (socket.handshake.headers.cookie || '')
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('jwt='));
      const user = await authenticate(
        socket.handshake.auth?.token || (cookie && decodeURIComponent(cookie.slice(4)))
      );
      if (!user.verified) return next(new Error('Vui lòng xác minh email.'));
      socket.userId = user.id;
      next();
    } catch {
      next(new Error('Phiên đăng nhập không hợp lệ.'));
    }
  });
  io.on('connection', (socket) => {
    const subscriptions = new Set();
    socket.on('room:subscribe', async (payload, callback) => {
      const roomId = payload?.roomId;
      const ack = typeof callback === 'function' ? callback : () => {};
      try {
        if (!/^[a-f0-9]{24}$/i.test(String(roomId)))
          return ack({ error: 'Mã phòng không hợp lệ.' });
        await engine.loadRoom(roomId, socket.userId);
        socket.join(`quiz:${roomId}`);
        subscriptions.add(roomId);
        const key = `${roomId}:${socket.userId}`;
        const connections = members.get(key) || new Set();
        connections.add(socket.id);
        members.set(key, connections);
        engine.publishRoom(roomId);
        ack({ ok: true });
      } catch {
        ack({ error: 'Bạn không có quyền tham gia phòng này.' });
      }
    });
    socket.on('disconnect', () => {
      for (const roomId of subscriptions) {
        const key = `${roomId}:${socket.userId}`;
        const connections = members.get(key);
        connections?.delete(socket.id);
        if (!connections?.size) members.delete(key);
        engine.publishRoom(roomId);
      }
    });
  });
}
module.exports = { init };
