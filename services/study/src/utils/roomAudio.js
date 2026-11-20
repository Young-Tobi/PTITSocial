const { RoomServiceClient } = require('livekit-server-sdk');
const AppError = require('@ptitsocial/service-kit/appError');
const FocusRoom = require('../models/focusRoomModel');
const Participant = require('../models/focusRoomParticipantModel');

function audioRoomName(room) {
  const version = room.audioVersion || 0;
  return `focus-${room._id}${version ? `-v${version}` : ''}`;
}

// Self-hosted LiveKit cannot revoke a cached JWT. Move active members to a new
// audio room so an old token cannot reconnect to their current conversation.
async function resetRoomAudio(roomId) {
  const previous = await FocusRoom.findByIdAndUpdate(roomId, { $inc: { audioVersion: 1 } }).select(
    '+audioVersion'
  );
  if (!previous) throw new AppError('Focus room not found', 404);
  await Participant.updateMany({ room: roomId, active: true }, { micEnabled: false });
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return;
  const url = new URL(LIVEKIT_URL);
  url.protocol = url.protocol === 'wss:' || url.protocol === 'https:' ? 'https:' : 'http:';
  const client = new RoomServiceClient(url.toString(), LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    requestTimeout: 3,
  });
  try {
    await client.deleteRoom(audioRoomName(previous));
  } catch (error) {
    // A room without any audio participants may not exist yet.
    if (error.code !== 'not_found' && error.status !== 404)
      throw new AppError('Cannot update room audio. Please try again.', 503);
  }
}

module.exports = { audioRoomName, resetRoomAudio };
