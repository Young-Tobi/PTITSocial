const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { AccessToken } = require('livekit-server-sdk');
const AppError = require('@ptitsocial/service-kit/appError');
const catchAsync = require('@ptitsocial/service-kit/catchAsync');
const FocusRoom = require('../models/focusRoomModel');
const Participant = require('../models/focusRoomParticipantModel');
const Message = require('../models/focusRoomMessageModel');
const { audioRoomName, resetRoomAudio } = require('../utils/roomAudio');
const { withPresence } = require('../utils/roomPresence');

const publicUser = 'first_name last_name username photo';

function ensureId(value, next) {
  if (!mongoose.isValidObjectId(value)) {
    next(new AppError('Invalid resource id', 400));
    return false;
  }
  return true;
}

function currentPomodoro(room) {
  const result = room.toObject ? room.toObject().pomodoro : { ...room.pomodoro };
  if (result.status === 'running' && result.endsAt) {
    result.remainingSeconds = Math.max(0, Math.ceil((new Date(result.endsAt) - Date.now()) / 1000));
  }
  return result;
}

exports.listRooms = catchAsync(async (req, res) => {
  const query = { privacy: 'public', active: true };
  if (req.query.q?.trim()) query.$text = { $search: req.query.q.trim().slice(0, 80) };
  const rooms = await FocusRoom.find(query)
    .select('-pomodoro.endsAt')
    .populate('owner', publicUser)
    .sort({ memberCount: -1, createdAt: -1 })
    .limit(100);
  res.json({ status: 'success', data: { rooms } });
});

exports.createRoom = catchAsync(async (req, res, next) => {
  const { name, description, topic, privacy, maxMembers, theme, password, allowMicrophones } =
    req.body;
  if (!name?.trim()) return next(new AppError('Room name is required', 400));
  const isPrivate = privacy === 'private';
  if (isPrivate && (!password || String(password).length < 4 || String(password).length > 64))
    return next(new AppError('Private room password must contain 4 to 64 characters', 400));
  const room = await FocusRoom.create({
    name,
    description,
    topic,
    privacy: isPrivate ? 'private' : 'public',
    maxMembers,
    theme,
    owner: req.user.id,
    memberCount: 1,
    allowMicrophones: allowMicrophones !== false,
    inviteCode: isPrivate ? crypto.randomBytes(5).toString('hex') : undefined,
    accessPasswordHash: isPrivate ? await bcrypt.hash(String(password), 12) : undefined,
  });
  await Participant.create({ room: room.id, user: req.user.id, role: 'host' });
  const body = room.toObject();
  delete body.accessPasswordHash;
  if (isPrivate) body.inviteCode = room.inviteCode;
  res.status(201).json({ status: 'success', data: { room: body } });
});

exports.joinRoom = catchAsync(async (req, res, next) => {
  if (!ensureId(req.params.roomId, next)) return;
  const room = await FocusRoom.findById(req.params.roomId).select(
    '+inviteCode +accessPasswordHash'
  );
  if (!room || !room.active) return next(new AppError('Focus room is not available', 404));
  if (room.privacy === 'private' && req.body.inviteCode !== room.inviteCode)
    return next(new AppError('Invalid invitation code', 403));
  if (
    room.privacy === 'private' &&
    room.accessPasswordHash &&
    !(await bcrypt.compare(String(req.body.password || ''), room.accessPasswordHash))
  )
    return next(new AppError('Incorrect room password', 403));

  const existing = await Participant.findOne({ room: room.id, user: req.user.id });
  if (existing?.kickedAt) return next(new AppError('You have been removed from this room', 403));
  if (existing?.active) return res.json({ status: 'success', data: { roomId: room.id } });

  const reserved = await FocusRoom.findOneAndUpdate(
    { _id: room.id, active: true, $expr: { $lt: ['$memberCount', '$maxMembers'] } },
    { $inc: { memberCount: 1 } },
    { new: true }
  );
  if (!reserved) return next(new AppError('Focus room is full', 409));
  try {
    if (existing) {
      existing.active = true;
      existing.micEnabled = false;
      existing.joinedAt = new Date();
      existing.leftAt = undefined;
      await existing.save();
    } else {
      await Participant.create({ room: room.id, user: req.user.id });
    }
  } catch (error) {
    await FocusRoom.updateOne({ _id: room.id }, { $inc: { memberCount: -1 } });
    throw error;
  }
  res.json({ status: 'success', data: { roomId: room.id } });
});

exports.getRoom = catchAsync(async (req, res, next) => {
  if (!ensureId(req.params.roomId, next)) return;
  const membership = await Participant.findOne({
    room: req.params.roomId,
    user: req.user.id,
    active: true,
  });
  if (!membership) return next(new AppError('Join this room before viewing it', 403));
  const room = await FocusRoom.findById(req.params.roomId)
    .select('+inviteCode')
    .populate('owner', publicUser);
  if (!room) return next(new AppError('Focus room not found', 404));
  const [participants, messages] = await Promise.all([
    Participant.find({ room: room.id, active: true }).populate('user', publicUser).sort('joinedAt'),
    Message.find({ room: room.id })
      .populate('sender', publicUser)
      .sort({ createdAt: -1 })
      .limit(60),
  ]);
  const body = room.toObject();
  body.pomodoro = currentPomodoro(room);
  if (String(room.owner._id) !== String(req.user.id)) delete body.inviteCode;
  res.json({
    status: 'success',
    data: {
      room: body,
      participants: withPresence(participants, req.studyIO, room.id),
      messages: messages.reverse(),
      isHost: membership.role === 'host',
    },
  });
});

exports.leaveRoom = catchAsync(async (req, res, next) => {
  if (!ensureId(req.params.roomId, next)) return;
  const membership = await Participant.findOne({
    room: req.params.roomId,
    user: req.user.id,
    active: true,
  });
  if (!membership) return next(new AppError('You are not in this room', 409));
  if (membership.role === 'host') return next(new AppError('The host must end the room', 409));
  membership.active = false;
  membership.micEnabled = false;
  membership.leftAt = new Date();
  await membership.save();
  await FocusRoom.updateOne(
    { _id: req.params.roomId, memberCount: { $gt: 0 } },
    { $inc: { memberCount: -1 } }
  );
  req.studyIO?.to(`focus:${req.params.roomId}`).emit('participant_left', { userId: req.user.id });
  req.studyIO?.in(`account:${req.user.id}`).socketsLeave(`focus:${req.params.roomId}`);
  await resetRoomAudio(req.params.roomId);
  req.studyIO?.to(`focus:${req.params.roomId}`).emit('focus_audio_reset');
  res.status(204).end();
});

exports.createLiveKitToken = catchAsync(async (req, res, next) => {
  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET || !process.env.LIVEKIT_URL)
    return next(new AppError('LiveKit is not configured on the server', 503));
  const membership = await Participant.findOne({
    room: req.params.roomId,
    user: req.user.id,
    active: true,
  });
  if (!membership) return next(new AppError('Only active room members can use audio', 403));
  const room = await FocusRoom.findOne({ _id: req.params.roomId, active: true }).select(
    '+audioVersion'
  );
  if (!room) return next(new AppError('Focus room is not available', 404));
  const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: String(req.user.id),
    name: `${req.user.first_name} ${req.user.last_name}`.trim(),
    ttl: '1m',
  });
  token.addGrant({
    roomJoin: true,
    room: audioRoomName(room),
    canPublish: room.allowMicrophones !== false,
    canSubscribe: true,
    canPublishData: false,
  });
  res.json({
    status: 'success',
    data: { token: await token.toJwt(), url: process.env.LIVEKIT_URL },
  });
});

exports.currentPomodoro = currentPomodoro;
