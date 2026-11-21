const assert = require('node:assert/strict');
const { pdf, office } = require('./fixtures.cjs');

module.exports = async function checkMultipleUploads(page, site, tag) {
  await page.goto(site + '/documents/new');
  const files = [
    { name: 'Outline ' + tag + '.pdf', mimeType: 'application/pdf', buffer: await pdf() },
    {
      name: 'Slides ' + tag + '.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      buffer: office('pptx'),
    },
  ];
  await page.locator('input[type=file][multiple]').setInputFiles(files);
  const titles = page.locator('input[name=title]');
  assert.equal(await titles.count(), 2);
  await titles.first().fill('Notes ' + tag);
  await page
    .getByLabel('Mô tả', { exact: true })
    .fill('Tài liệu dùng để kiểm tra luồng đăng nhiều tệp.');
  await page.getByLabel('Môn học', { exact: true }).selectOption('algorithms');
  await page.getByLabel('Chủ đề', { exact: true }).selectOption('outline');
  await page.getByRole('checkbox').check();
  const submit = page.getByRole('button', { name: 'Đăng tài liệu', exact: true });
  // Drop one response after the server has saved the file. A retry must reuse that record.
  const route = '**/api/v1/documents';
  const ids = [];
  const intercept = async (request) => {
    if (request.request().method() !== 'POST') return request.continue();
    const response = await request.fetch();
    assert(response.ok(), 'Upload returned ' + response.status());
    ids.push((await response.json()).data._id);
    if (ids.length === 2) return request.abort('failed');
    await request.fulfill({ response });
  };
  await page.route(route, intercept);
  try {
    await submit.click();
    await page.getByText('Đã đăng', { exact: true }).waitFor();
    await page.locator('form [role=alert]').waitFor();
    await submit.click();
    await page.waitForURL(site + '/documents/mine');
    assert.equal(ids.length, 3);
    assert.notEqual(ids[0], ids[1]);
    assert.equal(ids[1], ids[2]);
    await page.reload();
    for (const title of ['Notes ' + tag, 'Slides ' + tag]) {
      const link = page.getByRole('link', { name: title, exact: true });
      await link.waitFor();
      assert.equal(await link.count(), 1);
    }
  } finally {
    await page.unroute(route, intercept);
  }
};
