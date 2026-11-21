const assert = require('node:assert/strict');
const { pdf, office } = require('./fixtures.cjs');

module.exports = async function checkMultipleUploads(page, site, tag) {
  const title = 'Bộ bài giảng ' + tag;
  const files = [
    { name: 'Chương 1.pdf', mimeType: 'application/pdf', buffer: await pdf() },
    {
      name: 'Chương 2.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      buffer: office('pptx'),
    },
  ];
  await page.goto(site + '/documents/new');
  const picker = page.locator('input[type=file][multiple]');
  await picker.setInputFiles([
    ...files,
    { name: 'wrong.txt', mimeType: 'text/plain', buffer: Buffer.from('test') },
  ]);
  const titles = page.getByLabel('Tên tài liệu', { exact: true });
  assert.equal(await titles.count(), 1);
  await titles.fill(title);
  await page
    .getByLabel('Mô tả', { exact: true })
    .fill('Bộ tài liệu ôn tập gồm hai chương của cùng một môn.');
  await page.getByLabel('Môn học', { exact: true }).selectOption('algorithms');
  await page.getByLabel('Chủ đề', { exact: true }).selectOption('outline');
  await page.getByRole('checkbox').check();
  const submit = page.getByRole('button', { name: 'Đăng tài liệu', exact: true });
  await submit.click();
  const alert = page.locator('form [role=alert]');
  await alert.filter({ hasText: 'wrong.txt' }).waitFor();
  await picker.setInputFiles([
    files[0],
    { ...files[1], buffer: Buffer.from('Incomplete Office file') },
  ]);
  const broken = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/documents') && r.request().method() === 'POST'
  );
  await submit.click();
  const rejected = await broken;
  assert.equal(rejected.status(), 400);
  await alert.waitFor();
  const endpoint = rejected.url();
  async function lookup(scope, format) {
    const response = await page.request.get(
      endpoint + scope + '?q=' + tag + (format ? '&format=' + format : '')
    );
    assert.equal(response.status(), 200);
    const { data } = await response.json();
    return data.filter((row) => row.title === title);
  }
  assert.equal((await lookup('/mine')).length, 0);
  await picker.setInputFiles(files);
  // Lose the response after the server commits the whole post, then retry the same selection.
  const route = '**/api/v1/documents';
  const committed = [];
  await page.route(route, async (request) => {
    if (request.request().method() !== 'POST') return request.continue();
    const response = await request.fetch();
    assert(response.ok(), 'Upload returned ' + response.status());
    const { data } = await response.json();
    assert(!JSON.stringify(data).includes('storageKey'));
    committed.push(data._id);
    if (committed.length === 1) return request.abort('failed');
    await request.fulfill({ response });
  });
  try {
    await submit.click();
    await alert.waitFor();
    assert.equal(committed.length, 1);
    assert.equal((await lookup('/mine')).length, 1);
    await submit.click();
    await page.waitForURL(site + '/documents/' + committed[0]);
    assert.deepEqual(committed, [committed[0], committed[0]]);
  } finally {
    await page.unroute(route);
  }
  await page.reload();
  await page.getByRole('heading', { name: title, exact: true }).waitFor();
  for (const file of files) {
    const region = page.getByRole('region', { name: file.name, exact: true });
    await region.waitFor();
    const download = await region
      .getByRole('link', { name: 'Tải tài liệu xuống' })
      .getAttribute('href');
    const response = await page.request.get(new URL(download, page.url()).href);
    assert.equal(response.status(), 200);
    assert.deepEqual(await response.body(), file.buffer);
    if (file.mimeType === 'application/pdf') {
      await region.getByRole('button', { name: 'Xem trước PDF' }).click();
      await region.locator('iframe').waitFor();
    }
  }
  for (const format of ['pdf', 'pptx']) {
    const rows = await lookup('', format);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]._id, committed[0]);
    assert(!JSON.stringify(rows).includes('storageKey'));
  }
  for (const path of ['/documents', '/documents/mine']) {
    await page.goto(site + path + '?q=' + tag);
    const post = page.getByRole('link', { name: title, exact: true });
    await post.waitFor();
    assert.equal(await post.count(), 1);
    await post.locator('xpath=ancestor::article').getByText(/2 tệp/).waitFor();
  }
};
