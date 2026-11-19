// Serialize short room updates; never hold this lock while waiting for Judge0.
const pending = new Map();
async function withRoomLock(id, work) {
  const key = String(id),
    previous = pending.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(work);
  pending.set(key, next);
  try {
    return await next;
  } finally {
    if (pending.get(key) === next) pending.delete(key);
  }
}
module.exports = { withRoomLock };
