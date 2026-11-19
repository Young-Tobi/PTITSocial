const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { run } = require('./integration.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const site = process.env.TEST_WEB_URL || 'http://localhost:3000';
const artifacts = path.resolve(__dirname, '../../.local-tools/qa/academic');
run(async ({ a, b, tag }) => {
  const browser = await chromium.launch({
    channel: process.env.TEST_BROWSER_CHANNEL || 'chrome',
    headless: true,
  });
  const errors = [];
  await fs.mkdir(artifacts, { recursive: true });
  async function login(user) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(site + '/login');
    await page.locator('[name=email]').fill(user.email);
    await page.locator('[name=password]').fill('Backbook@123');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.waitForURL(site + '/');
    return page;
  }
  try {
    const first = await login(a),
      second = await login(b);
    await first.getByRole('link', { name: 'Hỏi đáp học thuật', exact: true }).first().click();
    await first.getByRole('heading', { name: 'Hỏi đáp học thuật', exact: true }).waitFor();
    await first.getByRole('link', { name: 'Đặt câu hỏi', exact: true }).click();
    await first.getByLabel('Tiêu đề', { exact: true }).fill('Lỗi MongoDB cần hỗ trợ ' + tag);
    await first.getByLabel('Môn học', { exact: true }).selectOption('web');
    await first.getByLabel('Thẻ chủ đề', { exact: true }).fill('MongoDB, node.js');
    const body =
      'Không kết nối được cơ sở dữ liệu.\n  Dòng mô tả tiếp theo.\n\n' +
      '\x60\x60\x60javascript\n  const uri = "mongodb://127.0.0.1";\n\x60\x60\x60\n' +
      '[Tài liệu](https://example.com)\n<script>window.qaAttack=true</script>\n<img src=x onerror="window.qaAttack=true">';
    await first.getByLabel(/Mô tả vấn đề/).fill(body);
    assert.equal(await first.locator('input[type=file]').count(), 0);
    for (const name of ['Chọn ảnh', 'Chèn đoạn mã', 'Chèn liên kết', 'Xem trước'])
      assert.equal(await first.getByRole('button', { name, exact: true }).count(), 0);
    await first.getByRole('button', { name: 'Đăng câu hỏi', exact: true }).click();
    await first.waitForURL(/\/questions\/[a-f0-9]{24}$/);
    const url = first.url();
    await first.getByRole('heading', { name: 'Lỗi MongoDB cần hỗ trợ ' + tag }).waitFor();
    async function assertPlainText(page, selector, value) {
      const content = page.locator(selector);
      assert.equal(await content.textContent(), value);
      assert.equal(await content.locator('a, img, script, pre, code').count(), 0);
      assert.equal(await content.evaluate((el) => getComputedStyle(el).whiteSpace), 'pre-wrap');
      assert.equal(await page.evaluate(() => window.qaAttack), undefined);
    }
    await assertPlainText(first, 'main > article > div[class*="_body_"]', body);
    await first.reload();
    await first.getByRole('heading', { name: 'Lỗi MongoDB cần hỗ trợ ' + tag }).waitFor();
    await assertPlainText(first, 'main > article > div[class*="_body_"]', body);
    await second.goto(url);
    assert.equal(await second.getByRole('button', { name: 'Xem trước', exact: true }).count(), 0);
    await second
      .getByLabel(/Nội dung câu trả lời/)
      .fill('Bạn kiểm tra MongoDB đang chạy và thử thay localhost bằng 127.0.0.1.');
    await second.getByRole('button', { name: 'Gửi câu trả lời', exact: true }).click();
    await second.getByText('Đã gửi câu trả lời.', { exact: true }).waitFor();
    await first.reload();
    const answer = first.getByRole('article', { name: 'Câu trả lời', exact: true });
    await answer.getByRole('button', { name: 'Hữu ích (0)', exact: true }).click();
    await answer.getByRole('button', { name: 'Hữu ích (1)', exact: true }).waitFor();
    await answer.getByRole('button', { name: 'Thảo luận (0)', exact: true }).click();
    await answer
      .getByLabel('Bình luận', { exact: true })
      .fill('Cảm ơn, mình đã kết nối thành công.');
    await answer.getByRole('button', { name: 'Gửi bình luận', exact: true }).click();
    await answer.getByText('Cảm ơn, mình đã kết nối thành công.', { exact: true }).waitFor();
    await answer.getByRole('button', { name: 'Chọn làm lời giải', exact: true }).click();
    await first.getByRole('article', { name: 'Lời giải được chọn', exact: true }).waitFor();
    await first.getByText('Đã giải quyết', { exact: true }).waitFor();
    await first.screenshot({ path: path.join(artifacts, 'solution-desktop.png'), fullPage: true });
    await second.reload();
    const accepted = second.getByRole('article', { name: 'Lời giải được chọn', exact: true });
    assert(await accepted.getByRole('button', { name: 'Hữu ích (1)', exact: true }).isDisabled());
    assert.equal(await second.getByRole('button', { name: 'Bỏ chọn lời giải' }).count(), 0);
    await first.getByRole('link', { name: 'Lĩnh vực quan tâm', exact: true }).click();
    await first.getByLabel('Lập trình Web', { exact: true }).check();
    await first.getByLabel('Thẻ chủ đề', { exact: true }).fill('mongodb');
    await first.getByRole('button', { name: 'Lưu lĩnh vực quan tâm', exact: true }).click();
    await first.getByText('Đã lưu lĩnh vực quan tâm.', { exact: true }).waitFor();
    await first
      .getByRole('navigation', { name: 'Điều hướng hỏi đáp' })
      .getByRole('link', { name: 'Hỏi đáp học thuật', exact: true })
      .click();
    await first.getByLabel('Tìm kiếm', { exact: true }).fill(String(tag));
    await first.getByLabel('Môn học', { exact: true }).selectOption('web');
    await first.getByLabel('Trạng thái', { exact: true }).selectOption('resolved');
    await first.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
    await first.getByRole('heading', { name: 'Danh sách câu hỏi (2)' }).waitFor();
    await first.reload();
    assert.equal(await first.getByLabel('Tìm kiếm', { exact: true }).inputValue(), String(tag));
    await first.setViewportSize({ width: 390, height: 844 });
    await first.screenshot({ path: path.join(artifacts, 'list-mobile.png'), fullPage: true });
    assert(await first.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await first.goto(url);
    await first.getByRole('article', { name: 'Lời giải được chọn', exact: true }).waitFor();
    assert(await first.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await first.screenshot({ path: path.join(artifacts, 'solution-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log(
      'PASS browser: plain text/reload/XSS, no attachments, answer/comment/vote/solution, interests/filters/mobile'
    );
  } catch (error) {
    for (const [index, context] of browser.contexts().entries()) {
      const page = context.pages()[0];
      if (page)
        await page.screenshot({
          path: path.join(artifacts, 'failure-' + index + '.png'),
          fullPage: true,
        });
    }
    throw error;
  } finally {
    await browser.close();
  }
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
