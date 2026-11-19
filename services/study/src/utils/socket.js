const { Server } = require('socket.io');
const { authenticate } = require('@ptitsocial/service-kit/auth');
const FocusRoom = require('../models/focusRoomModel');
const Participant = require('../models/focusRoomParticipantModel');
const Message = require('../models/focusRoomMessageModel');
const { currentPomodoro } = require('../controllers/focusRoomController');

let io;
const publicUser = 'first_name last_name username photo';

function socketToken(socket) {
  const cookie = (socket.handshake.headers.cookie || '')
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith('jwt='));
  return socket.handshake.auth?.token || (cookie && decodeURIComponent(cookie.slice(4)));
}
const activeMember = (roomId, userId) =>
  Participant.findOne({ room: roomId, user: userId, active: true });
const roomState = (roomId) =>
  Participant.find({ room: roomId, active: true }).populate('user', publicUser).sort('joinedAt');
const requireHost = (roomId, userId) =>
  Participant.findOne({
    room: roomId,
    user: userId,
    active: true,
    role: 'host',
  });
function respond(ack, error, data) {
  if (typeof ack === 'function')
    ack(error ? { ok: false, message: error.message } : { ok: true, data });
}

function init(server, options) {
  io = new Server(server, { ...options, path: '/study-socket.io' });
  io.use(async (socket, next) => {
    try {
      const account = await authenticate(socketToken(socket));
      if (!account.verified) return next(new Error('Verified account required'));
      const { id, username, first_name, last_name, photo } = account;
      socket.account = { id, username, first_name, last_name, photo };
      socket.join(`account:${id}`);
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const joined = new Set();
    const on = (event, handler) =>
      socket.on(event, async (payload = {}, ack) => {
        try {
          respond(ack, null, await handler(payload));
        } catch (error) {
          respond(ack, error);
        }
      });

    on('focus_join', async ({ roomId }) => {
      if (!(await activeMember(roomId, socket.account.id))) throw new Error('Join the room first');
      const room = await FocusRoom.findOne({ _id: roomId, active: true });
      if (!room) throw new Error('Room is not active');
      socket.join(`focus:${roomId}`);
      joined.add(String(roomId));
      socket.to(`focus:${roomId}`).emit('focus_presence', { type: 'online', user: socket.account });
      return { participants: await roomState(roomId), pomodoro: currentPomodoro(room) };
    });

    on('focus_message', async ({ roomId, text }) => {
      if (!(await activeMember(roomId, socket.account.id)))
        throw new Error('Room membership required');
      const clean = String(text || '').trim();
      if (!clean || clean.length > 1000) throw new Error('Message must contain 1-1000 characters');
      const message = await Message.create({
        room: roomId,
        sender: socket.account.id,
        text: clean,
      });
      await message.populate('sender', publicUser);
      io.to(`focus:${roomId}`).emit('focus_message', message);
      return message;
    });

    on('focus_mic', async ({ roomId, enabled }) => {
      if (enabled) {
        const room = await FocusRoom.findOne({ _id: roomId, active: true });
        if (!room) throw new Error('Room is not active');
        if (!room.allowMicrophones) throw new Error('The host has disabled microphones');
      }
      const participant = await Participant.findOneAndUpdate(
        { room: roomId, user: socket.account.id, active: true },
        { micEnabled: Boolean(enabled) },
        { new: true }
      );
      if (!participant) throw new Error('Room membership required');
      const state = { userId: socket.account.id, enabled: Boolean(enabled) };
      io.to(`focus:${roomId}`).emit('focus_mic', state);
      return state;
    });

    on('focus_mic_policy', async ({ roomId, enabled }) => {
      if (!(await requireHost(roomId, socket.account.id)))
        throw new Error('Host permission required');
      const room = await FocusRoom.findOneAndUpdate(
        { _id: roomId, active: true },
        { allowMicrophones: Boolean(enabled) },
        { new: true }
      );
      if (!room) throw new Error('Room is not active');
      if (!room.allowMicrophones) {
        await Participant.updateMany({ room: roomId, active: true }, { micEnabled: false });
        io.to(`focus:${roomId}`).emit('focus_force_mute', {
          roomId,
          reason: 'Microphones have been disabled by the host',
        });
      }
      const state = { enabled: room.allowMicrophones };
      io.to(`focus:${roomId}`).emit('focus_mic_policy', state);
      return state;
    });

    on('focus_mute_participant', async ({ roomId, userId }) => {
      if (!(await requireHost(roomId, socket.account.id)))
        throw new Error('Host permission required');
      const participant = await Participant.findOneAndUpdate(
        { room: roomId, user: userId, active: true, role: { $ne: 'host' } },
        { micEnabled: false },
        { new: true }
      );
      if (!participant) throw new Error('Participant not found');
      io.to(`account:${userId}`).emit('focus_force_mute', {
        roomId,
        reason: 'Your microphone was turned off by the host',
      });
      io.to(`focus:${roomId}`).emit('focus_mic', { userId, enabled: false });
      return { userId };
    });

    on('pomodoro_control', async ({ roomId, action, focusMinutes, breakMinutes }) => {
      if (!(await requireHost(roomId, socket.account.id)))
        throw new Error('Host permission required');
      const room = await FocusRoom.findOne({ _id: roomId, active: true });
      if (!room) throw new Error('Room is not active');
      if (Number.isInteger(focusMinutes) && focusMinutes >= 1 && focusMinutes <= 120)
        room.pomodoro.focusMinutes = focusMinutes;
      if (Number.isInteger(breakMinutes) && breakMinutes >= 1 && breakMinutes <= 60)
        room.pomodoro.breakMinutes = breakMinutes;
      const now = Date.now();
      if (action === 'start' || action === 'resume') {
        const duration =
          action === 'resume'
            ? room.pomodoro.remainingSeconds
            : (room.pomodoro.mode === 'focus'
                ? room.pomodoro.focusMinutes
                : room.pomodoro.breakMinutes) * 60;
        room.pomodoro.status = 'running';
        room.pomodoro.remainingSeconds = duration;
        room.pomodoro.endsAt = new Date(now + duration * 1000);
      } else if (action === 'pause' && room.pomodoro.status === 'running') {
        room.pomodoro.remainingSeconds = Math.max(
          0,
          Math.ceil((room.pomodoro.endsAt - now) / 1000)
        );
        room.pomodoro.status = 'paused';
        room.pomodoro.endsAt = undefined;
      } else if (action === 'reset') {
        room.pomodoro.status = 'idle';
        room.pomodoro.mode = 'focus';
        room.pomodoro.remainingSeconds = room.pomodoro.focusMinutes * 60;
        room.pomodoro.endsAt = undefined;
      } else if (action === 'end') {
        room.pomodoro.status = 'ended';
        room.pomodoro.remainingSeconds = 0;
        room.pomodoro.endsAt = undefined;
      } else if (!['start', 'resume', 'pause', 'reset', 'end'].includes(action)) {
        throw new Error('Invalid Pomodoro action');
      }
      await room.save();
      const state = currentPomodoro(room);
      io.to(`focus:${roomId}`).emit('pomodoro_state', state);
      return state;
    });

    on('focus_kick', async ({ roomId, userId }) => {
      if (!(await requireHost(roomId, socket.account.id)))
        throw new Error('Host permission required');
      if (String(userId) === String(socket.account.id))
        throw new Error('Host cannot kick themselves');
      const participant = await Participant.findOneAndUpdate(
        { room: roomId, user: userId, active: true },
        { active: false, micEnabled: false, leftAt: new Date() },
        { new: true }
      );
      if (!participant) throw new Error('Participant not found');
      await FocusRoom.updateOne(
        { _id: roomId, memberCount: { $gt: 0 } },
        { $inc: { memberCount: -1 } }
      );
      io.to(`focus:${roomId}`).emit('focus_kicked', { userId });
      return { userId };
    });

    on('focus_end', async ({ roomId }) => {
      if (!(await requireHost(roomId, socket.account.id)))
        throw new Error('Host permission required');
      const room = await FocusRoom.findOneAndUpdate(
        { _id: roomId, active: true },
        { active: false, endedAt: new Date(), memberCount: 0, 'pomodoro.status': 'ended' },
        { new: true }
      );
      if (!room) throw new Error('Room is already ended');
      await Participant.updateMany(
        { room: roomId, active: true },
        { active: false, micEnabled: false, leftAt: new Date() }
      );
      io.to(`focus:${roomId}`).emit('focus_ended');
      return { roomId };
    });

    socket.on('disconnect', async () => {
      for (const roomId of joined) {
        await Participant.updateOne(
          { room: roomId, user: socket.account.id },
          { micEnabled: false }
        ).catch(() => {});
        socket
          .to(`focus:${roomId}`)
          .emit('focus_presence', { type: 'offline', user: socket.account });
        socket
          .to(`focus:${roomId}`)
          .emit('focus_mic', { userId: socket.account.id, enabled: false });
      }
    });
  });

  const phaseTimer = setInterval(async () => {
    const due = await FocusRoom.find({
      active: true,
      'pomodoro.status': 'running',
      'pomodoro.endsAt': { $lte: new Date() },
    });
    for (const room of due) {
      room.pomodoro.mode = room.pomodoro.mode === 'focus' ? 'break' : 'focus';
      const seconds =
        (room.pomodoro.mode === 'focus' ? room.pomodoro.focusMinutes : room.pomodoro.breakMinutes) *
        60;
      room.pomodoro.remainingSeconds = seconds;
      room.pomodoro.endsAt = new Date(Date.now() + seconds * 1000);
      await room.save();
      io.to(`focus:${room.id}`).emit('pomodoro_phase', currentPomodoro(room));
    }
  }, 1000);
  phaseTimer.unref();
  return io;
}

module.exports = { init, getIO: () => io };
