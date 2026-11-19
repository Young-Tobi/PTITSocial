const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');
const { io } = require('../../apps/web/node_modules/socket.io-client');
const { run } = require('./integration.cjs');
const Notification = require('../../services/content/src/features/academic/utils/notificationClient');
require('dotenv').config({ path: path.resolve('services/content/.env') });
const base = process.env.TEST_API_URL || 'http://localhost:8000';
const site = process.env.TEST_WEB_URL || 'http://localhost:3000';

async function until(check) {
  const deadline = Date.now() + 10000;
  while (!check()) {
    assert(Date.now() < deadline, 'Expected notification was not delivered');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

run(async ({ a, b, c, api, tag }) => {
  const sockets = [],
    received = new Map();
  let browser;
  const artifacts = path.resolve('.local-tools/qa/academic-notifications');
  await fs.mkdir(artifacts, { recursive: true });
  const title = 'Thông báo câu trả lời học thuật ' + tag;
  const question = (
    await api(
      'POST',
      '/academic/questions',
      a,
      {
        title,
        body: 'Cần giải thích cách kết nối và xử lý dữ liệu trong MongoDB.',
        subject: 'web',
        tags: [],
      },
      201
    )
  ).data;
  const target = '/questions/' + question._id;
  const history = async (user) =>
    (await api('GET', '/users/notifications', user)).data.notifications.filter(
      (n) => n.click === target
    );
  try {
    for (const user of [a, b, c]) {
      await history(user);
      const events = [];
      received.set(user._id, events);
      const socket = io(base, {
        auth: { token: user.token },
        transports: ['websocket'],
        reconnection: false,
        timeout: 5000,
      });
      sockets.push(socket);
      socket.on('academic_notification', ({ notification }) => {
        if (notification.click === target) events.push(notification);
      });
      await new Promise((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
      });
    }
    const answer = (
      await api(
        'POST',
        '/academic/questions/' + question._id + '/answers',
        b,
        { body: 'Bạn kiểm tra chuỗi kết nối và dịch vụ MongoDB.', recipient: c._id },
        201
      )
    ).data;
    assert.equal(answer.notificationPending, undefined);
    await until(() => received.get(a._id).length === 1);
    const notification = received.get(a._id)[0];
    assert.equal(notification.type, 'comment');
    assert.equal(notification.academicKind, 'answer');
    assert.equal(notification.sender._id, b._id);
    assert(notification.content.includes(title));
    assert(notification.sender.photo);
    assert.equal(received.get(b._id).length, 0);
    assert.equal(received.get(c._id).length, 0);
    assert.equal((await api('PUT', '/users/ping', a)).unseenNotification, 1);
    assert.equal((await history(a)).length, 1);
    await api('PUT', '/users/notifications/' + notification._id + '/seen', c, {}, 404);
    await api('PUT', '/users/notifications/' + notification._id + '/seen', a, {});
    assert.equal((await history(a))[0].seen, 'seen');
    await api(
      'POST',
      '/academic/questions/' + question._id + '/answers',
      c,
      { body: 'short' },
      400
    );
    assert.equal((await history(a)).length, 1);

    // Re-delivery after an uncertain HTTP result must not create a second notification/counter.
    await Promise.all(
      Array.from({ length: 4 }, () =>
        new Notification({
          sender: b,
          recipient: a,
          questionId: question._id,
          questionTitle: title,
          sourceId: answer._id,
        }).sendAcademicAnswer()
      )
    );
    assert.equal((await history(a)).length, 1);
    assert.equal((await api('PUT', '/users/ping', a)).unseenNotification, 0);

    await api(
      'POST',
      '/academic/answers/' + answer._id + '/comments',
      a,
      { body: 'Mình kiểm tra như thế nào?' },
      201
    );
    await until(() => received.get(b._id).length === 1);
    assert.equal(received.get(b._id)[0].academicKind, 'comment');
    assert.equal(received.get(a._id).length, 1);
    await api(
      'POST',
      '/academic/answers/' + answer._id + '/comments',
      c,
      { body: 'Hai bạn thử kiểm tra lại cổng kết nối.' },
      201
    );
    await until(() => received.get(a._id).length === 2 && received.get(b._id).length === 2);
    assert.equal(received.get(c._id).length, 0);
    assert.equal((await history(c)).length, 0);
    sockets[0].disconnect();
    await api(
      'POST',
      '/academic/questions/' + question._id + '/answers',
      c,
      { body: 'Câu trả lời khi người hỏi đang ngoại tuyến.' },
      201
    );
    assert.equal((await api('PUT', '/users/ping', a)).unseenNotification, 2);
    assert.equal((await history(a)).length, 3);
    console.log(
      'PASS academic notifications: recipients, no self-notify, permissions, counters, seen, offline persistence and deduplicated retries'
    );

    browser = await chromium.launch({
      channel: process.env.TEST_BROWSER_CHANNEL || 'chrome',
      headless: true,
    });
    const errors = [];
    async function login(user) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        colorScheme: 'dark',
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(site + '/login');
      await page.locator('[name=email]').fill(user.email);
      await page.locator('[name=password]').fill('Backbook@123');
      await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      await page.waitForURL(site + '/');
      await page.goto(site + target);
      await page.getByRole('heading', { name: title, exact: true }).waitFor();
      return page;
    }
    const owner = await login(a),
      author = await login(b);
    // Keep the owner's notification menu open: the new row must appear without reloading.
    const bell = owner.locator('svg:has(path[d^="M7.847 23.488"])').locator('..');
    await bell.click();
    const responseText = 'Câu trả lời gửi từ trình duyệt ' + tag;
    await author.getByLabel(/Nội dung câu trả lời/).fill(responseText);
    await author.getByRole('button', { name: 'Gửi câu trả lời', exact: true }).click();
    await author.getByText('Đã gửi câu trả lời.', { exact: true }).waitFor();
    await owner.getByText(responseText, { exact: true }).waitFor();
    await owner.getByText('Thông báo mới', { exact: true }).waitFor();
    const menu = owner.locator('[class*="NotificationMenu_menu"]');
    const row = menu
      .getByText(
        b.first_name + ' ' + b.last_name + ' đã trả lời câu hỏi của bạn: “' + title + '”.',
        { exact: true }
      )
      .first();
    await row.waitFor();
    assert.equal(await bell.innerText(), '1');
    for (const img of await menu.locator('img').all()) {
      assert(
        await img.evaluate((el) => el.complete && el.naturalWidth > 0),
        'Notification image should load'
      );
    }
    await owner.screenshot({ path: path.join(artifacts, 'notification-menu.png'), fullPage: true });
    const markedSeen = owner.waitForResponse(
      (response) =>
        response.url().includes('/notifications/') &&
        response.url().endsWith('/seen') &&
        response.request().method() === 'PUT'
    );
    await row.click();
    assert.equal((await markedSeen).status(), 200);
    await owner.waitForURL(site + target);
    await owner.getByText(responseText, { exact: true }).waitFor();
    const latest = (await history(a))[0];
    assert.equal(latest.seen, 'seen');
    await owner.goto(site + '/questions');
    await bell.click();
    await menu.getByText(notification.content, { exact: true }).first().click();
    await owner.waitForURL(site + target);
    await owner.getByText(responseText, { exact: true }).waitFor();
    await owner.reload();
    await bell.click();
    await menu.getByText(notification.content, { exact: true }).first().waitFor();
    assert.deepEqual(errors, []);
    console.log(
      'PASS browser academic notifications: realtime toast/badge/open menu, refreshed answers, notification navigation, seen and reload'
    );
  } catch (error) {
    if (browser)
      for (const [i, context] of browser.contexts().entries()) {
        if (context.pages()[0])
          await context
            .pages()[0]
            .screenshot({ path: path.join(artifacts, 'failure-' + i + '.png'), fullPage: true });
      }
    throw error;
  } finally {
    sockets.forEach((socket) => socket.close());
    await browser?.close();
  }
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
