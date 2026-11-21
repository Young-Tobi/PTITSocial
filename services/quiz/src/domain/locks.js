// A single Quiz Service process serializes changes per room. MongoDB persists state.
// Multiple replicas would require a distributed lock or transactional CAS updates.
const pending = new Map();
async function withRoomLock(roomId, operation) {
  const key = String(roomId);
  const previous = pending.get(key) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  pending.set(key, current);
  try {
    return await current;
  } finally {
    if (pending.get(key) === current) pending.delete(key);
  }
}
module.exports = { withRoomLock };
