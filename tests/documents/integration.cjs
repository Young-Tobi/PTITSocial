const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { run } = require('../academic/integration.cjs');
const { pdf, office } = require('./fixtures.cjs');
const { types } = require('../../services/content/src/features/documents/storage');
const apiBase = process.env.TEST_API_URL || 'http://localhost:8000';
const site = process.env.TEST_WEB_URL || 'http://localhost:3000';
run(async ({ a, b, api, tag }) => {
  const folder = path.resolve('.local-tools/qa/documents');
  await fs.mkdir(folder, { recursive: true });
  const adminPassword = process.env.TEST_DOCUMENT_ADMIN_PASSWORD;
  assert(adminPassword, 'Set TEST_DOCUMENT_ADMIN_PASSWORD for the configured document moderator.');
  const login = await api(
    'POST',
    '/users/login',
    null,
    { email: 'admin@gmail.com', password: adminPassword },
    201
  );
  const admin = { ...login.data.user, token: login.data.token };
  const title = 'Study algorithms ' + tag,
    body = 'Detailed study outline on sorting and graph algorithms.';
  const buffer = await pdf();
  let browser;
  async function upload(format = 'pdf', overrides = {}, expected = 201, attachment) {
    const form = new FormData();
    for (const [key, value] of Object.entries({
      title,
      description: body,
      subject: 'algorithms',
      topic: 'outline',
      keywords: '["graph"]',
      source: 'Student original material',
      rightsConfirmed: 'true',
      ...overrides,
    }))
      form.set(key, value);
    form.set(
      'file',
      new Blob([format === 'pdf' ? buffer : office(format)], { type: types[format] }),
      'study.' + format
    );
    if (attachment)
      form.append('file', new Blob([attachment], { type: types.pdf }), 'chapter-2.pdf');
    return (await api('POST', '/documents', a, form, expected)).data;
  }
  async function file(route, user, expected = 200, headers = {}) {
    const response = await fetch(apiBase + '/api/v1/documents' + route, {
      headers: { ...(user ? { authorization: 'Bearer ' + user.token } : {}), ...headers },
    });
    assert.equal(response.status, expected, route);
    return response;
  }
  try {
    await api('GET', '/documents', null, undefined, 401);
    const secondPdf = await require('pdf-lib').PDFDocument.load(buffer);
    secondPdf.addPage();
    const chapter = Buffer.from(await secondPdf.save());
    const main = await upload('pdf', {}, 201, chapter);
    const attachment = '/' + main._id + '/download?file=1';
    assert.deepEqual(Buffer.from(await (await file(attachment, b)).arrayBuffer()), chapter);
    await file(attachment, null, 401);
    await file('/' + main._id + '/download?file=2', b, 404);
    await file('/' + main._id + '/download?file=-1', b, 400);
    await file('/' + main._id + '/preview?file=1', b, 206, { range: 'bytes=0-9' });
    assert(!main.storageKey);
    assert.equal(main.author, a._id);
    assert.deepEqual(
      Buffer.from(await (await file('/' + main._id + '/download', b)).arrayBuffer()),
      buffer
    );
    await file('/' + main._id + '/download', null, 401);
    const range = await file('/' + main._id + '/preview', b, 206, { range: 'bytes=0-9' });
    assert.equal(range.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.match(range.headers.get('content-security-policy'), /frame-ancestors 'self'/);
    assert.equal((await range.arrayBuffer()).byteLength, 10);
    for (const format of ['docx', 'pptx']) {
      const doc = await upload(format);
      await file('/' + doc._id + '/preview', b, 415);
      assert.deepEqual(
        Buffer.from(await (await file('/' + doc._id + '/download', b)).arrayBuffer()),
        office(format)
      );
    }
    await upload('pdf', { rightsConfirmed: 'false' }, 400);
    await upload('pdf', { title: '' }, 400);
    await api('PATCH', '/documents/' + main._id, b, {}, 403);
    await api('DELETE', '/documents/' + main._id, b, undefined, 403);
    await api('PUT', '/documents/' + main._id + '/helpful', a, {}, 403);
    await Promise.all(
      Array.from({ length: 8 }, () => api('PUT', '/documents/' + main._id + '/helpful', b, {}))
    );
    await Promise.all(
      Array.from({ length: 8 }, () => api('PUT', '/documents/' + main._id + '/favorite', b, {}))
    );
    let detail = (await api('GET', '/documents/' + main._id, b)).data;
    assert.equal(detail.helpfulCount, 1);
    assert(detail.isHelpful && detail.isFavorite);
    assert.equal((await api('GET', '/documents/saved', b)).total, 1);
    await api('DELETE', '/documents/' + main._id + '/helpful', b);
    assert.equal((await api('GET', '/documents/' + main._id, b)).data.helpfulCount, 0);
    await api('PUT', '/documents/' + main._id + '/helpful', b, {});
    const comment = (
      await api(
        'POST',
        '/documents/' + main._id + '/comments',
        b,
        { body: 'This study outline is useful.' },
        201
      )
    ).data;
    await api('DELETE', '/documents/comments/' + comment._id, a, undefined, 403);
    await api('POST', '/documents/' + main._id + '/comments', b, { body: ' ' }, 400);
    const report = (
      await api(
        'POST',
        '/documents/' + main._id + '/reports',
        b,
        { reason: 'copyright', body: 'Please check permission to share.' },
        201
      )
    ).data;
    await api(
      'POST',
      '/documents/' + main._id + '/reports',
      b,
      { reason: 'copyright', body: 'Duplicate report request.' },
      409
    );
    await api('GET', '/documents/moderation/reports', b, undefined, 403);
    await api(
      'PATCH',
      '/documents/moderation/documents/' + main._id + '/status',
      b,
      { status: 'hidden', reason: 'Not permitted' },
      403
    );
    const matches = (
      await api(
        'GET',
        '/documents?q=' + tag + '&subject=algorithms&topic=outline&format=pdf&sort=helpful',
        b
      )
    ).data;
    assert.equal(matches[0]._id, main._id);
    for (let i = 0; i < 19; i++) await upload('pdf', { title: 'Pagination ' + tag + ' ' + i });
    const p1 = await api('GET', '/documents?q=' + tag, b),
      p2 = await api('GET', '/documents?q=' + tag + '&page=2', b);
    assert.equal(p1.total, 22);
    assert.equal(p1.data.length, 20);
    assert.equal(p2.data.length, 2);
    assert(!p2.data.some((d) => p1.data.some((p) => p._id === d._id)));
    console.log(
      'PASS documents API: three formats, range/download, validation, owner permissions, concurrent votes/favorites, comments, reports and pagination'
    );
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    async function pageFor(email, password) {
      const page = await (
        await browser.newContext({ viewport: { width: 1440, height: 1000 } })
      ).newPage();
      page.setDefaultTimeout(15000);
      await page.goto(site + '/login');
      await page.locator('[name=email]').fill(email);
      await page.locator('[name=password]').fill(password);
      await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      await page.waitForURL(site + '/');
      return page;
    }
    const first = await pageFor(a.email, 'PtitDemo@2026'),
      second = await pageFor(b.email, 'PtitDemo@2026'),
      manager = await pageFor('admin@gmail.com', adminPassword);
    const errors = [];
    for (const p of [first, second, manager]) p.on('pageerror', (e) => errors.push(e.message));
    await require('./multiple.cjs')(first, site, tag);
    console.log(
      'PASS two files in one post: upload retry, atomic validation, single gallery entry and exact downloads'
    );
    await first.goto(site + '/documents/new');
    await first.getByRole('button', { name: 'Đăng tài liệu', exact: true }).click();
    assert(
      await first.getByLabel('Tên tài liệu', { exact: true }).evaluate((el) => !el.validity.valid)
    );
    const uiTitle = 'Tài liệu kiểm thử ' + tag;
    await first.getByLabel('Tên tài liệu', { exact: true }).fill(uiTitle);
    await first.getByLabel('Mô tả', { exact: true }).fill(body);
    await first.getByLabel('Môn học', { exact: true }).selectOption('algorithms');
    await first.getByLabel('Chủ đề', { exact: true }).selectOption('outline');
    await first.getByLabel('Từ khóa', { exact: true }).fill('graph');
    await first
      .locator('input[type=file]')
      .setInputFiles({ name: 'study.pdf', mimeType: types.pdf, buffer });
    await first.getByRole('checkbox').check();
    await first.getByRole('button', { name: 'Đăng tài liệu', exact: true }).click();
    await first.waitForURL(/\/documents\/[a-f0-9]{24}$/);
    await first.reload();
    await first.getByRole('heading', { name: uiTitle }).waitFor();
    await first.getByRole('link', { name: 'Sửa thông tin', exact: true }).click();
    await first.getByLabel('Tên tài liệu', { exact: true }).fill(uiTitle + ' sửa');
    await first.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await first.getByRole('heading', { name: uiTitle + ' sửa' }).waitFor();
    await second.goto(site + '/documents/' + main._id);
    const mainFile = second.getByRole('region', { name: 'study.pdf', exact: true });
    await mainFile.getByRole('button', { name: 'Xem trước PDF', exact: true }).click();
    await second.locator('iframe[title="Xem trước tài liệu PDF"]').waitFor();
    const download = second.waitForEvent('download');
    await mainFile.getByRole('link', { name: 'Tải tài liệu xuống' }).click();
    assert.equal((await download).suggestedFilename(), 'study.pdf');
    await second.getByRole('button', { name: 'Bỏ lưu', exact: true }).click();
    await second.getByRole('button', { name: 'Lưu yêu thích', exact: true }).waitFor();
    await second.getByRole('button', { name: 'Lưu yêu thích', exact: true }).click();
    await second.getByRole('button', { name: 'Bỏ lưu', exact: true }).waitFor();
    await second.getByLabel('Nhận xét', { exact: true }).fill('Tài liệu hữu ích cho ôn tập.');
    await second.getByRole('button', { name: 'Gửi nhận xét', exact: true }).click();
    await second.getByText('Tài liệu hữu ích cho ôn tập.', { exact: true }).waitFor();
    await second.goto(
      site + '/documents?q=' + tag + '&subject=algorithms&topic=outline&sort=helpful'
    );
    await second.getByLabel('Môn học', { exact: true }).waitFor();
    await second.reload();
    assert.equal(await second.getByLabel('Môn học', { exact: true }).inputValue(), 'algorithms');
    await manager.goto(site + '/documents/moderation');
    const card = manager
      .locator('main > article')
      .filter({ has: manager.getByRole('link', { name: title, exact: true }) });
    await card.getByLabel('Lý do xử lý').fill('Cần xác minh quyền chia sẻ tài liệu.');
    await card.getByRole('button', { name: 'Ẩn tài liệu', exact: true }).click();
    await manager.getByText('Đã xử lý báo cáo.', { exact: true }).waitFor();
    await file('/' + main._id + '/download', b, 404);
    await file('/' + main._id + '/preview', b, 404);
    await file(attachment, b, 404);
    await file('/' + main._id + '/preview?file=1', b, 404);
    await api('GET', '/documents/' + main._id, b, undefined, 404);
    assert.equal((await api('GET', '/documents/saved', b)).total, 0);
    assert(
      (await api('GET', '/documents/mine', a)).data.some(
        (d) => d._id === main._id && d.status === 'hidden'
      ) ||
        (await api('GET', '/documents/mine?page=2', a)).data.some(
          (d) => d._id === main._id && d.status === 'hidden'
        )
    );
    await manager.getByLabel('Trạng thái báo cáo').selectOption('resolved');
    await card.getByLabel('Lý do xử lý').fill('Đã xác nhận được phép chia sẻ.');
    const restored = manager.waitForResponse(
      (r) =>
        r.url().endsWith('/moderation/documents/' + main._id + '/status') &&
        r.request().method() === 'PATCH'
    );
    await card.getByRole('button', { name: 'Khôi phục tài liệu', exact: true }).click();
    assert.equal((await restored).status(), 200);
    await file('/' + main._id + '/download', b);
    await file(attachment, b);
    assert.equal(
      (await api('GET', '/documents/moderation/reports?status=resolved', admin)).data.find(
        (r) => r._id === report._id
      ).handledBy._id,
      admin._id
    );
    await second.goto(site + '/documents/' + main._id);
    await second.getByRole('heading', { name: title, exact: true }).waitFor();
    await second.screenshot({ path: path.join(folder, 'detail-desktop.png'), fullPage: true });
    await second.setViewportSize({ width: 390, height: 844 });
    assert(await second.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await second.screenshot({ path: path.join(folder, 'detail-mobile.png'), fullPage: true });
    first.on('dialog', (dialog) => dialog.accept());
    await first.getByRole('button', { name: 'Xóa tài liệu', exact: true }).click();
    await first.waitForURL(site + '/documents/mine');
    assert.deepEqual(errors, []);
    console.log(
      'PASS documents browser: upload/edit/reload, preview/download, favorites/comments, filters, moderator hide/restore, deletion and mobile'
    );
  } finally {
    if (browser) await browser.close();
    const documents = [];
    for (let page = 1; ; page++) {
      const result = await api('GET', '/documents/mine?page=' + page, a);
      documents.push(...result.data);
      if (page * 20 >= result.total) break;
    }
    for (const doc of documents) await api('DELETE', '/documents/' + doc._id, a);
    assert.equal((await api('GET', '/documents/mine', a)).total, 0);
  }
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
