const { Room, Submission } = require('./models');
// Keep the original room/submission fields as well as the new representation.
// Old rooms are archived: their creator previously competed under different rules.
async function migrate() {
  const rooms = await Room.collection.find({ version: { $ne: 2 } }).toArray();
  for (const room of rooms) {
    const host = room.players.find((p) => p.userId === room.hostId);
    const problems = room.problem ? [room.problem] : [];
    const players = room.players.map((player) => ({
      ...player,
      scores:
        room.problem && player.bestPassed > 0
          ? [
              {
                problemId: String(room.problem._id),
                passed: player.bestPassed,
                total: room.problem.tests.length,
                bestAt: player.bestAt,
              },
            ]
          : [],
    }));
    if (room.problem)
      await Submission.collection.updateMany(
        { roomId: room._id, problemId: { $exists: false } },
        { $set: { problemId: String(room.problem._id) } }
      );
    await Room.collection.updateOne(
      { _id: room._id },
      {
        $set: {
          version: 2,
          legacy: true,
          visibility: 'private',
          hostName: host?.name || 'Người tổ chức',
          hostPhoto: host?.photo,
          problems,
          players,
          blockedIds: [],
          status: 'finished',
          finishReason: room.status === 'finished' ? room.finishReason : 'format_updated',
        },
      }
    );
  }
  if (rooms.length)
    console.log(`Archived ${rooms.length} old coding rooms; submissions preserved.`);
}
module.exports = { migrate };
