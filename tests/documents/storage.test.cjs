const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const express = require('express');
const storage = require('../../services/content/src/features/documents/storage');
const { Document, Cleanup } = require('../../services/content/src/features/documents/models');
const v = require('../../services/content/src/features/documents/validation');
const { pdf, office, zip } = require('./fixtures.cjs');
const file = (format, buffer) => ({
  originalname: 'study.' + format,
  mimetype: storage.types[format],
  buffer,
});
test('accepts PDF/DOCX/PPTX and exact 20 MiB; rejects oversized, forged, active or broken files', async () => {
  const valid = await pdf();
  await storage.validate(
    file('docx', office('docx', { 'word/printerSettings/printerSettings1.bin': 'print settings' }))
  );
  for (const format of ['pdf', 'docx', 'pptx'])
    assert.equal(
      (await storage.validate(file(format, format === 'pdf' ? valid : office(format)))).format,
      format
    );
  const exact = Buffer.concat([
    valid,
    Buffer.alloc(storage.maxBytes - valid.length - 6, 32),
    Buffer.from('%%EOF\n'),
  ]);
  await storage.validate(file('pdf', exact));
  for (const input of [
    file('pdf', Buffer.alloc(storage.maxBytes + 1)),
    file('pdf', Buffer.from('fake')),
    file('docx', valid),
    file('pptx', office('docx')),
    file('pdf', await pdf(true)),
    file('pdf', await pdf('launch')),
    file('docx', office('docx', { 'word/vbaProject.bin': 'bad' })),
    file('docx', office('docx', { 'word/document.xml': '<broken>' })),
    file('docx', zip({ 'x.xml': '<x/>' })),
  ])
    await assert.rejects(storage.validate(input), { statusCode: 400 });
  assert.throws(() => storage.location('../secret.pdf'));
});
test('metadata requires valid categories, bounded keywords and Vietnam dates', () => {
  const valid = {
    title: 'Study outline',
    description: 'Detailed learning material description.',
    subject: 'algorithms',
    topic: 'outline',
    keywords: [' Algorithm ', 'algorithm'],
  };
  assert.deepEqual(v.metadata(valid).keywords, ['algorithm']);
  for (const patch of [
    { title: '' },
    { description: '' },
    { subject: 'bad' },
    { topic: 'bad' },
    { keywords: Array(6).fill('tag') },
  ])
    assert.throws(() => v.metadata({ ...valid, ...patch }));
  assert.throws(() => v.filters({ from: '2026-02-30' }));
  assert.throws(() => v.filters({ q: {} }));
  assert.equal(
    v.filters({ from: '2026-11-16' }).createdAt.$gte.toISOString(),
    '2026-11-15T17:00:00.000Z'
  );
});
for (const failure of ['write', 'database'])
  test('upload cleans its file after ' + failure + ' failure', async (t) => {
    const jobs = [];
    const removed = [];
    t.mock.method(Cleanup, 'create', async (job) => {
      jobs.push(job);
    });
    t.mock.method(Cleanup, 'deleteOne', async () => {});
    t.mock.method(Document, 'create', async () => {
      throw new Error('Injected DB failure');
    });
    const remove = storage.remove;
    t.mock.method(storage, 'remove', async (key) => {
      removed.push(key);
      return remove(key);
    });
    if (failure === 'write')
      t.mock.method(storage, 'write', async () => {
        throw new Error('Injected disk failure');
      });
    t.mock.method(console, 'error', () => {});
    const app = express();
    app.use((req, res, next) => {
      req.user = { id: '507f1f77bcf86cd799439011' };
      next();
    });
    app.use('/documents', require('../../services/content/src/features/documents/routes'));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    try {
      const form = new FormData();
      for (const [key, value] of Object.entries({
        title: 'Test material',
        description: 'A valid study material description.',
        subject: 'web',
        topic: 'outline',
        rightsConfirmed: 'true',
      }))
        form.set(key, value);
      form.set('file', new Blob([await pdf()], { type: 'application/pdf' }), 'study.pdf');
      const response = await fetch('http://127.0.0.1:' + server.address().port + '/documents', {
        method: 'POST',
        body: form,
      });
      assert.equal(response.status, 500);
      assert.equal(jobs.length, 1);
      assert.deepEqual(removed, [jobs[0].key]);
      await assert.rejects(fs.access(storage.location(jobs[0].key)), { code: 'ENOENT' });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
