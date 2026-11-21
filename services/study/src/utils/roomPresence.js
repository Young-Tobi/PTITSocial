function onlineUserIds(io, roomId) {
  const ids = new Set();
  for (const socketId of io?.sockets.adapter.rooms.get(`focus:${roomId}`) || []) {
    const userId = io.sockets.sockets.get(socketId)?.account?.id;
    if (userId) ids.add(String(userId));
  }
  return ids;
}

function withPresence(participants, io, roomId) {
  const online = onlineUserIds(io, roomId);
  return participants.map((participant) => {
    const data = participant.toObject ? participant.toObject() : participant;
    return { ...data, online: online.has(String(data.user?._id || data.user)) };
  });
}

module.exports = { onlineUserIds, withPresence };
