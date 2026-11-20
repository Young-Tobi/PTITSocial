const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { retrieve } = require('../services/learning/src/retrieval');
const { EmbeddingIndex } = require('../services/learning/src/models');
const provider = require('../services/learning/src/provider');
const catalog = require('../services/learning/src/catalog');
const { KeyPool } = require('../services/learning/src/keyPool');
const vector = () => Array(768).fill(0.1);

function fixture(t, initial, embed) {
  let stored = initial;
  const sizes = [];
  t.mock.method(EmbeddingIndex, 'findOne', () => ({ lean: async () => stored }));
  t.mock.method(EmbeddingIndex, 'findOneAndUpdate', (filter, update) => ({
    lean: async () => {
      stored = { key: filter.key, vectors: [...update.$set.vectors] };
      sizes.push(stored.vectors.length);
      return stored;
    },
  }));
  t.mock.method(provider, 'embed', embed);
  return { sizes, saved: () => stored };
}

test('cold index retries only the throttled batch, preserves order and caches all sources', async (t) => {
  const batches = [];
  let throttled = false;
  const store = fixture(t, null, async (texts, settings, task) => {
    if (task === 'RETRIEVAL_DOCUMENT') {
      batches.push([...texts]);
      if (batches.length === 3 && !throttled) {
        throttled = true;
        throw Object.assign(new Error('Minute quota'), { statusCode: 429, retryAfterMs: 1 });
      }
    }
    return texts.map(vector);
  });
  assert((await retrieve('Python', {})).length > 0);
  assert.deepEqual(
    batches.map((b) => b.length),
    [40, 40, 38, 38]
  );
  assert.deepEqual(batches[2], batches[3]);
  assert.deepEqual(store.sizes, [40, 80, catalog.length]);
  assert.equal(store.saved().vectors.length, catalog.length);
  await retrieve('JavaScript', {});
  assert.equal(batches.length, 4, 'Completed index is reused');
});

test('daily quota stops promptly, retaining completed batches for the next request', async (t) => {
  let calls = 0;
  const store = fixture(t, null, async (texts) => {
    if (++calls === 2)
      throw Object.assign(new Error('Daily quota'), { statusCode: 429, retryAfterMs: 86400000 });
    return texts.map(vector);
  });
  await assert.rejects(() => retrieve('Python', {}), { statusCode: 429 });
  assert.equal(calls, 2);
  assert.equal(store.saved().vectors.length, 40);
  const resumed = [];
  provider.embed.mock.mockImplementation(async (texts, settings, task) => {
    if (task === 'RETRIEVAL_DOCUMENT') resumed.push(texts.length);
    return texts.map(vector);
  });
  await retrieve('Python', {});
  assert.deepEqual(resumed, [40, 38], 'Already completed documents are not embedded again');
});

test('concurrent first requests share the same index job', async (t) => {
  let batches = 0;
  fixture(t, null, async (texts, settings, task) => {
    if (task === 'RETRIEVAL_DOCUMENT') batches++;
    await new Promise((resolve) => setImmediate(resolve));
    return texts.map(vector);
  });
  const answers = await Promise.all([retrieve('Python', {}), retrieve('Web', {})]);
  assert(answers.every((items) => items.length > 0));
  assert.equal(batches, Math.ceil(catalog.length / 40));
});

test('an invalid persisted prefix is rebuilt instead of reused', async (t) => {
  const batches = [];
  fixture(t, { vectors: [] }, async (texts, settings, task) => {
    if (task === 'RETRIEVAL_DOCUMENT') batches.push(texts.length);
    return texts.map(vector);
  });
  await retrieve('Web', {});
  assert.deepEqual(batches, [40, 40, 38]);
});

test('pool reports remaining quota delay and clears it after expiry', () => {
  let now = 1000;
  const pool = new KeyPool(2, () => now);
  pool.block(0, 'embed', 60000, 429);
  pool.block(1, 'embed', 90000, 429);
  now += 10000;
  assert.equal(pool.retryAfter('embed'), 50000);
  assert.equal(pool.retryAfter('generate'), 0);
  now += 80001;
  assert.equal(pool.retryAfter('embed'), 0);
});
