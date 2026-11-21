const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { MongoClient, ObjectId } = require('mongodb');
const base = 'http://localhost:8000',
  prefix = '/api/v1/coding',
  tag = Date.now(),
  users = [];
const mongo = new MongoClient('mongodb://127.0.0.1:27017');
const programs = {
  c: '#ifdef __cplusplus\n#error Must compile as C\n#endif\n#include <stdio.h>\nint main(){int n;long long x,s=0;scanf("%d",&n);while(n--){scanf("%lld",&x);s+=x;}printf("%lld",s);return 0;}',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;int main(){int n;cin>>n;long long s=0,x;while(n--){cin>>x;s+=x;}cout<<s;}',
  java: 'import java.util.*; public class Main {public static void main(String[] args){Scanner sc=new Scanner(System.in);int n=sc.nextInt();long s=0;while(n-->0)s+=sc.nextLong();System.out.println(s);}}',
  python: 'import sys\na=list(map(int,sys.stdin.buffer.read().split()))\nprint(sum(a[1:]))',
};
const broken = {
  c: 'not valid C',
  cpp: 'not valid C++',
  java: 'public class Main { this is broken }',
  python: 'if True print(5)',
};
const infinite = {
  c: 'int main(){while(1){}}',
  cpp: 'int main(){volatile int x=0;while(true)x++;}',
  java: 'public class Main {public static void main(String[] args){while(true){}}}',
  python: 'while True:\n    pass',
};
async function api(user, method, path, body, expected = 200) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(user ? { authorization: 'Bearer ' + user.token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  return data.data;
}
const coding = (user, method, path, body, expected) =>
  api(user, method, prefix + path, body, expected);
async function account(index) {
  const email = `coding-language-${tag}-${index}@example.com`;
  const data = await api(null, 'POST', '/api/v1/users/signup', {
    first_name: 'Language',
    last_name: 'Tester' + index,
    email,
    password: 'PtitDemo@2026',
    passwordConfirm: 'PtitDemo@2026',
    gender: 'male',
    birth_Year: 2003,
    birth_Month: 1,
    birth_Day: 15,
  });
  const user = { ...data.user, token: data.token, email };
  users.push(user);
  const inbox = await (await fetch('http://localhost:8025/api/v1/messages?limit=100')).json();
  const mail = inbox.messages.find((m) => m.To.some((to) => to.Address === email));
  assert(mail);
  user.mailId = mail.ID;
  const detail = await (await fetch('http://localhost:8025/api/v1/message/' + mail.ID)).json();
  await api(
    user,
    'POST',
    '/api/v1/users/emailVerification',
    { token: (detail.Text || detail.HTML).match(/\/activate\/([a-f0-9]+)/)[1] },
    201
  );
  return user;
}
async function waitJob(user, roomId, id) {
  for (let i = 0; i < 150; i++) {
    const data = await coding(user, 'GET', '/rooms/' + roomId),
      job = data.submissions.find((s) => s.id === id);
    if (job && ['done', 'error'].includes(job.status)) return job;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw Error('Submission timeout');
}
async function main() {
  await mongo.connect();
  const host = await account('host'),
    players = {};
  for (const language of Object.keys(programs)) players[language] = await account(language);
  const status = await coding(host, 'GET', '/status');
  assert.equal(status.ready, true);
  assert.deepEqual(status.languages.map((l) => l.key).sort(), Object.keys(programs).sort());
  const catalog = await coding(host, 'GET', '/problems'),
    problemId = catalog.problems.find((p) => p.title === 'Tổng dãy số').id;
  const room = (
    await coding(
      host,
      'POST',
      '/rooms',
      {
        title: 'Languages ' + tag,
        visibility: 'private',
        maxPlayers: 4,
        durationMinutes: 5,
        problemIds: [problemId],
      },
      201
    )
  ).room;
  for (const user of Object.values(players))
    await coding(user, 'POST', '/rooms/join', { code: room.code });
  await coding(host, 'POST', `/rooms/${room.id}/start`, {});
  for (const language of ['javascript', 'constructor', '__proto__', 123, {}, []])
    await coding(
      players.c,
      'POST',
      `/rooms/${room.id}/run`,
      { code: programs.c, problemId, language, requestId: randomUUID() },
      400
    );
  for (const [language, code] of Object.entries(programs)) {
    const user = players[language],
      body = {
        language,
        code,
        problemId,
        requestId: randomUUID(),
        language_id: 54,
        compiler_options: 'ignored',
      };
    const sent = await coding(user, 'POST', `/rooms/${room.id}/run`, body, 202);
    const retried = await coding(user, 'POST', `/rooms/${room.id}/run`, body, 202);
    assert.equal(sent.id, retried.id);
    await coding(
      user,
      'POST',
      `/rooms/${room.id}/run`,
      { ...body, language: language === 'c' ? 'cpp' : 'c' },
      409
    );
    let job = await waitJob(user, room.id, sent.id);
    assert.equal(job.status, 'done', JSON.stringify(job));
    assert.equal(job.passed, 1, JSON.stringify(job));
    assert.equal(job.language, language);
    const source = await coding(user, 'GET', `/submissions/${sent.id}/code`);
    assert.equal(source.code, code);
    assert.equal(source.language, language);
    await coding(host, 'GET', `/submissions/${sent.id}/code`, undefined, 404);
    let attempt = await coding(
      user,
      'POST',
      `/rooms/${room.id}/run`,
      { language, code: broken[language], problemId, requestId: randomUUID() },
      202
    );
    job = await waitJob(user, room.id, attempt.id);
    assert.equal(job.status, 'done', JSON.stringify(job));
    assert.equal(job.passed, 0);
    if (language === 'python') assert(job.results[0].stderr.includes('SyntaxError'));
    else assert(job.compileOutput);
    attempt = await coding(
      user,
      'POST',
      `/rooms/${room.id}/run`,
      { language, code: infinite[language], problemId, requestId: randomUUID() },
      202
    );
    job = await waitJob(user, room.id, attempt.id);
    assert.equal(job.results[0].status, 'Time Limit Exceeded', JSON.stringify(job));
    console.log(
      'PASS ' +
        language +
        ': real sample, source language, idempotency, compile/syntax error, timeout and server-controlled compiler'
    );
  }
  const accepted = [];
  for (const [language, user] of Object.entries(players)) {
    const result = await coding(
      user,
      'POST',
      `/rooms/${room.id}/submit`,
      { language, code: programs[language], problemId, requestId: randomUUID() },
      202
    );
    accepted.push({ user, id: result.id, language });
  }
  await coding(host, 'POST', `/rooms/${room.id}/end`, {});
  for (const job of accepted) {
    const result = await waitJob(job.user, room.id, job.id);
    assert.equal(result.points, 100, JSON.stringify(result));
    assert.equal(result.language, job.language);
    assert.equal(result.results, undefined);
  }
  const final = await coding(host, 'GET', '/rooms/' + room.id);
  assert.equal(final.room.status, 'finished');
  assert.equal(final.leaderboard.length, 4);
  assert(final.leaderboard.every((p) => p.points === 100));
  assert(!final.leaderboard.some((p) => p.userId === host._id));
  assert.deepEqual(
    [...new Set(final.activity.map((s) => s.language))].sort(),
    Object.keys(programs).sort()
  );
  console.log(
    'PASS four languages compete in the same room/problem, hidden-test score is identical, accepted jobs finish after deadline, host sees language without code'
  );
}
async function cleanup() {
  const ids = users.map((u) => new ObjectId(u._id)),
    strings = users.map((u) => u._id),
    db = mongo.db('ptitsocial_coding');
  const rooms = await db
    .collection('codingrooms')
    .find({ hostId: { $in: strings } })
    .toArray();
  await db.collection('codingsubmissions').deleteMany({ roomId: { $in: rooms.map((r) => r._id) } });
  await db.collection('codingrooms').deleteMany({ hostId: { $in: strings } });
  await mongo
    .db('ptitsocial_accounts')
    .collection('users')
    .deleteMany({ _id: { $in: ids } });
  for (const domain of ['content', 'messaging'])
    await mongo
      .db('ptitsocial_' + domain)
      .collection('user_projections')
      .deleteMany({ _id: { $in: ids } });
  for (const u of users)
    if (u.mailId)
      await fetch('http://localhost:8025/api/v1/messages/' + u.mailId, { method: 'DELETE' });
  await mongo.close();
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(cleanup);
