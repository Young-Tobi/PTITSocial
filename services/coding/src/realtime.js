const { Server } = require('socket.io');
const { authenticate } = require('@ptitsocial/service-kit/auth');
const engine = require('./engine');
function init(server, options) {
  const io = new Server(server, { ...options, path: '/coding-socket' });
  const members = new Map();
  engine.configureRealtime({
    publish: (id) => io.to('coding:' + id).emit('room:updated', { roomId: id }),
    online: (id, userId) => !!members.get(id + ':' + userId)?.size,
  });
  io.use(async (socket, next) => {
    try {
      const user = await authenticate(socket.handshake.auth?.token);
      if (!user.verified) throw Error();
      socket.userId = user.id;
      next();
    } catch {
      next(Error('Vui lòng đăng nhập và xác minh email.'));
    }
  });
  io.on('connection', (socket) => {
    const joined = new Set();
    socket.on('room:subscribe', async (payload, callback) => {
      const ack = typeof callback === 'function' ? callback : () => {};
      try {
        const id = payload?.roomId;
        if (typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id)) throw Error();
        await engine.member(id, socket.userId);
        socket.join('coding:' + id);
        joined.add(id);
        const key = id + ':' + socket.userId;
        const sockets = members.get(key) || new Set();
        sockets.add(socket.id);
        members.set(key, sockets);
        ack({ ok: true });
        engine.publish(id);
      } catch {
        ack({ error: 'Bạn không có quyền vào phòng.' });
      }
    });
    socket.on('disconnect', () => {
      for (const id of joined) {
        const key = id + ':' + socket.userId;
        members.get(key)?.delete(socket.id);
        if (!members.get(key)?.size) members.delete(key);
        engine.publish(id);
      }
    });
  });
}
module.exports = { init };
