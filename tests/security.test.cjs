const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { createRateLimiter } = require('../packages/service-kit/src/security');
const { rejectUnsafeMongoKeys } = require('../packages/service-kit/src/security');

test('simple query parsing rejects operator-shaped field names but accepts search text', async () => {
  const app = express();
  app.set('query parser', 'simple');
  app.use(rejectUnsafeMongoKeys);
  app.get('/', (req, res) => res.json({ ok: true }));
  app.use((err, req, res, next) =>
    res.status(err.statusCode || 500).json({ message: err.message })
  );
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const url = `http://127.0.0.1:${server.address().port}/`;
  try {
    for (const query of ['q[$ne]=', '$where=bad', 'user.name=x'])
      assert.equal((await fetch(url + '?' + query)).status, 400);
    assert.equal((await fetch(url + '?q=MongoDB%20%24ne')).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('polling limits isolate authenticated users behind one gateway and reject forged identities', async () => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'local-security-regression-secret';
  const app = express();
  app.use(createRateLimiter({ max: 2, windowMs: 60000, message: 'limited' }));
  app.get('/', (req, res) => res.json({ ok: true }));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const url = `http://127.0.0.1:${server.address().port}/`;
  const tokens = ['a'.repeat(24), 'b'.repeat(24)].map((id) =>
    jwt.sign({ id }, process.env.JWT_SECRET)
  );
  const request = (token) => fetch(url, { headers: { authorization: 'Bearer ' + token } });
  try {
    assert.equal((await request(tokens[0])).status, 200);
    assert.equal((await request(tokens[0])).status, 200);
    assert.equal((await request(tokens[0])).status, 429);
    assert.equal((await request(tokens[1])).status, 200);
    for (let n = 0; n < 2; n++) assert.equal((await request('forged-' + n)).status, 200);
    assert.equal((await request('another-forged-identity')).status, 429);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
});
