const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
function read(file) {
  return fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
}
function save(file, values) {
  fs.writeFileSync(
    file,
    Object.entries(values)
      .map(([key, value]) => `${key}=${JSON.stringify(String(value))}`)
      .join('\n') + '\n'
  );
}
const previous = read(path.join(root, 'legacy/backbook-server/.env'));
const current = read(path.join(root, '.env'));
const shared = {
  APP_NAME: 'BACKBOOK',
  FRONTEND_URL: 'http://localhost:3000',
  BACKEND_URL: 'http://localhost:8000',
  NODE_ENV: 'development',
  JWT_SECRET: crypto.randomBytes(48).toString('hex'),
  JWT_EXPIRES_IN: '7d',
  JWT_COOKIE_EXPIRES_IN: '7',
  MEDIA_STORAGE: 'local',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
  EMAIL_ID: 'ptitsocial@localhost.test',
  ...previous,
  ...current,
};
shared.INTERNAL_API_KEY = current.INTERNAL_API_KEY || crypto.randomBytes(48).toString('hex');
shared.ACCOUNTS_URL = 'http://127.0.0.1:8001';
shared.CONTENT_URL = 'http://127.0.0.1:8002';
shared.MESSAGING_URL = 'http://127.0.0.1:8003';
shared.QUIZ_URL = 'http://127.0.0.1:8004';
shared.CODING_URL = 'http://127.0.0.1:8005';
shared.JUDGE0_URL = 'http://127.0.0.1:2358';
shared.JUDGE0_AUTH_TOKEN = current.JUDGE0_AUTH_TOKEN || crypto.randomBytes(32).toString('hex');
shared.JUDGE0_POSTGRES_PASSWORD = current.JUDGE0_POSTGRES_PASSWORD || crypto.randomBytes(32).toString('hex');
shared.JUDGE0_REDIS_PASSWORD = current.JUDGE0_REDIS_PASSWORD || crypto.randomBytes(32).toString('hex');
delete shared.PORT;
delete shared.DATABASE;
save(path.join(root, '.env'), shared);
for (const [name, port] of [
  ['gateway', 8000],
  ['accounts', 8001],
  ['content', 8002],
  ['messaging', 8003],
  ['quiz', 8004],
  ['coding', 8005],
]) {
  const config = { ...shared, ...read(path.join(root, 'services', name, '.env')), PORT: port };
  if (name !== 'gateway') config.DATABASE = `mongodb://127.0.0.1:27017/ptitsocial_${name}`;
  save(path.join(root, 'services', name, '.env'), config);
}
const judgeDirectory=path.join(root,'infra','judge0');
fs.mkdirSync(judgeDirectory,{recursive:true});
save(path.join(judgeDirectory,'judge0.conf'),{
  POSTGRES_HOST:'judge-db',POSTGRES_DB:'judge0',POSTGRES_USER:'judge0',POSTGRES_PASSWORD:shared.JUDGE0_POSTGRES_PASSWORD,
  REDIS_HOST:'judge-redis',REDIS_PASSWORD:shared.JUDGE0_REDIS_PASSWORD,AUTHN_TOKEN:shared.JUDGE0_AUTH_TOKEN,
  JUDGE0_TELEMETRY_ENABLE:'false',COUNT:1,MAX_QUEUE_SIZE:32,
  ENABLE_NETWORK:'false',ALLOW_ENABLE_NETWORK:'false',ENABLE_CALLBACKS:'false',ENABLE_ADDITIONAL_FILES:'false',
  ENABLE_COMPILER_OPTIONS:'true',ENABLE_COMMAND_LINE_ARGUMENTS:'false',
  ENABLE_PER_PROCESS_AND_THREAD_TIME_LIMIT:'true',ENABLE_PER_PROCESS_AND_THREAD_MEMORY_LIMIT:'true',
  ALLOW_ENABLE_PER_PROCESS_AND_THREAD_TIME_LIMIT:'true',ALLOW_ENABLE_PER_PROCESS_AND_THREAD_MEMORY_LIMIT:'true',
  CPU_TIME_LIMIT:2,MAX_CPU_TIME_LIMIT:10,WALL_TIME_LIMIT:5,MAX_WALL_TIME_LIMIT:20,
  MEMORY_LIMIT:262144,MAX_MEMORY_LIMIT:2097152,MAX_PROCESSES_AND_OR_THREADS:2,MAX_MAX_PROCESSES_AND_OR_THREADS:32,
  MAX_FILE_SIZE:64,MAX_MAX_FILE_SIZE:128,ENABLE_WAIT_RESULT:'false',SUBMISSION_CACHE_DURATION:0,
});
const webEnv = path.join(root, 'apps/web/.env.local');
if (!fs.existsSync(webEnv)) {
  save(webEnv, {
    REACT_APP_BACKEND_URL: 'http://localhost:8000',
    REACT_APP_ENABLE_FIREBASE: 'false',
    HOST: 'localhost',
    PORT: '3000',
    BROWSER: 'none',
  });
}
console.log('Local service configuration ready. Existing session secret preserved.');
