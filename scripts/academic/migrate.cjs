const { MongoClient } = require('mongodb');
const { parse } = require('dotenv');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');

async function run() {
  const clients = [];
  try {
    async function database(service) {
      const env = parse(await fs.readFile(path.join(root, 'services', service, '.env')));
      const client = await new MongoClient(env.DATABASE).connect();
      clients.push(client);
      return client.db();
    }
    const accounts = await database('accounts'),
      content = await database('content'),
      messaging = await database('messaging');
    const interests = await accounts
      .collection('users')
      .find({ academicInterests: { $exists: true } })
      .project({ academicInterests: 1 })
      .toArray();
    const notifications = await messaging
      .collection('notifications')
      .find({ type: { $in: ['academic_answer', 'academic_comment'] } })
      .toArray();
    if (interests.length || notifications.length) {
      const folder = path.join(root, '.local-backups', 'academic-data-' + Date.now());
      await fs.mkdir(folder, { recursive: true });
      await fs.writeFile(
        path.join(folder, 'legacy.json'),
        JSON.stringify({ interests, notifications }, null, 2)
      );
      console.log('Academic data backup:', folder);
    }
    for (const entry of interests) {
      const data = {
        subjects: entry.academicInterests.subjects || [],
        tags: entry.academicInterests.tags || [],
      };
      await content.collection('academic_interests').updateOne(
        { user: entry._id },
        {
          $setOnInsert: {
            user: entry._id,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
      const saved = await content.collection('academic_interests').findOne({ user: entry._id });
      assert.deepEqual(
        { subjects: saved.subjects, tags: saved.tags },
        data,
        'Existing interests differ; legacy data was preserved'
      );
      await accounts
        .collection('users')
        .updateOne(
          { _id: entry._id, academicInterests: entry.academicInterests },
          { $unset: { academicInterests: 1 } }
        );
    }
    for (const entry of notifications) {
      const academicKind = entry.type === 'academic_answer' ? 'answer' : 'comment';
      await messaging.collection('notifications').updateOne(
        { _id: entry._id, type: entry.type },
        {
          $set: {
            type: 'comment',
            academicKind,
            academicEventKey: entry.eventKey || `legacy-academic:${entry._id}`,
          },
          $unset: { eventKey: 1 },
        }
      );
    }
    console.log(
      `Migrated ${interests.length} interests and ${notifications.length} academic notifications; content and read state preserved.`
    );
  } finally {
    await Promise.all(clients.map((client) => client.close()));
  }
}
run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
