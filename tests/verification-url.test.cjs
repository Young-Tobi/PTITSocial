const { test } = require('node:test');
const assert = require('node:assert/strict');
const verificationUrl = require('../services/accounts/src/utils/verificationUrl');

function configured(overrides, fn) {
  const keys = ['PUBLIC_APP_URL', 'FRONTEND_URL', 'CORS_ORIGINS'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    PUBLIC_APP_URL: 'https://demo.example.test',
    FRONTEND_URL: 'http://localhost:3000',
    CORS_ORIGINS: '',
    ...overrides,
  });
  try {
    fn();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}
const request = (origin) => ({ headers: { origin } });

test('local registration and resend stay local despite a saved public tunnel URL', () => {
  configured({}, () => {
    for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000'])
      assert.equal(verificationUrl(request(origin), 'token'), origin + '/activate/token');
  });
});
test('public and LAN browsers retain their configured application origin', () => {
  configured({ FRONTEND_URL: 'http://192.168.1.20:3000' }, () => {
    for (const origin of ['https://demo.example.test', 'http://192.168.1.20:3000'])
      assert.equal(verificationUrl(request(origin), 'token'), origin + '/activate/token');
  });
});
test('additional configured CORS origins are supported', () => {
  configured({ CORS_ORIGINS: ' http://localhost:3100,https://study.example.test ' }, () => {
    assert.equal(
      verificationUrl(request('http://localhost:3100'), 'token'),
      'http://localhost:3100/activate/token'
    );
  });
});
test('unknown origins and spoofed host headers cannot inject an email destination', () => {
  configured({}, () => {
    for (const origin of ['https://attacker.test', 'https://demo.example.test.attacker.test', 'null'])
      assert.equal(
        verificationUrl({ headers: { origin, host: 'attacker.test', 'x-forwarded-host': 'attacker.test' } }, 'token'),
        'https://demo.example.test/activate/token'
      );
  });
});
test('nonbrowser callers fall back to configured public URL', () => {
  configured({}, () => {
    assert.equal(verificationUrl({ headers: {} }, 'token'), 'https://demo.example.test/activate/token');
  });
});
test('invalid public URLs fall back to the frontend without accepting credentials or script URLs', () => {
  for (const value of ['invalid', 'javascript:alert(1)', 'https://user:pass@attacker.test'])
    configured({ PUBLIC_APP_URL: value }, () => {
      assert.equal(verificationUrl({ headers: {} }, 'token'), 'http://localhost:3000/activate/token');
    });
});
