const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const root = path.resolve(__dirname, '..');

function readEnv(file, required = true) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    if (required) throw new Error(`Missing ${file}. Restore your local configuration first.`);
    return {};
  }
  return dotenv.parse(fs.readFileSync(fullPath));
}

function configuration() {
  const ports = { mongo: 27017, smtp: 1025, mailpit: 8025 };
  const defaults = { accounts: 8001, content: 8002, messaging: 8003, gateway: 8000 };
  for (const [name, fallback] of Object.entries(defaults)) {
    const env = readEnv(`services/${name}/.env`);
    ports[name] = Number(env.PORT || fallback);
    if (name !== 'gateway') {
      const database = new URL(env.DATABASE);
      if (
        database.protocol !== 'mongodb:' ||
        !['127.0.0.1', 'localhost'].includes(database.hostname) ||
        Number(database.port || 27017) !== ports.mongo
      ) {
        throw new Error(`${name}: this launcher requires MongoDB on localhost:27017.`);
      }
    }
  }
  const web = Object.assign(
    {},
    ...['.env', '.env.development', '.env.local', '.env.development.local'].map((file) =>
      readEnv(`apps/web/${file}`, false)
    )
  );
  ports.frontend = Number(web.PORT || 3000);
  if (Object.values(ports).some((port) => !Number.isInteger(port) || port < 1 || port > 65535))
    throw new Error('Invalid port in local configuration.');
  if (new Set(Object.values(ports)).size !== Object.keys(ports).length)
    throw new Error('Two local components are configured to use the same port.');
  const backend = new URL(web.REACT_APP_BACKEND_URL);
  if (
    !['127.0.0.1', 'localhost'].includes(backend.hostname) ||
    backend.protocol !== 'http:' ||
    Number(backend.port || 80) !== ports.gateway
  ) {
    throw new Error('REACT_APP_BACKEND_URL must match the local gateway port.');
  }
  return {
    ports,
    webUrl: `http://localhost:${ports.frontend}`,
    gatewayUrl: `http://127.0.0.1:${ports.gateway}`,
    mailUrl: `http://127.0.0.1:${ports.mailpit}`,
  };
}

async function shutdownMongo() {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient('mongodb://127.0.0.1:27017', {
    serverSelectionTimeoutMS: 3000,
    socketTimeoutMS: 10000,
  });
  try {
    await client.connect();
    try {
      await client.db('admin').command({ shutdown: 1 });
    } catch (error) {
      // MongoDB closes the connection while shutting down. The caller also waits for process exit.
      if (error.name !== 'MongoNetworkError') throw error;
    }
  } finally {
    await client.close();
  }
}

(async () => {
  if (process.argv[2] === 'config') console.log(JSON.stringify(configuration()));
  else if (process.argv[2] === 'shutdown-mongo') await shutdownMongo();
  else throw new Error('Expected config or shutdown-mongo.');
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
