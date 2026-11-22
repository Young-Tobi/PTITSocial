const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { run } = require('./integration.cjs');
const site = process.env.TEST_WEB_URL || 'http://localhost:3000';
const folder = path.resolve('.local-tools/qa/academic-checklist');
const results = [];

async function check(group, name, work) {
  const start = Date.now();
  try {
    await work();
    results.push({ group, name, status: 'PASS', durationMs: Date.now() - start });
    console.log('PASS ' + group + ': ' + name);
  } catch (error) {
    results.push({ group, name, status: 'FAIL', error: error.message });
    throw error;
  }
}

run(async ({ a, b, api, tag }) => {
  await fs.mkdir(folder, { recursive: true });
  const browser = await chromium.launch({
    channel: process.env.TEST_BROWSER_CHANNEL || 'chrome',
    headless: true,
  });
  const errors = [];
  let first, second;
  const marker = 'qa' + tag,
    titleWord = 'tieude' + tag,
    bodyWord = 'noidung' + tag;
  const title = 'Câu hỏi ' + titleWord;
  const body =
    'Mô tả vấn đề học tập ' + bodyWord + '.\n  Nội dung đã kiểm tra trước khi đặt câu hỏi.';
  const cards = (page) => page.locator('main > article');
  const recommendations = (page) =>
    page
      .locator('main > section')
      .filter({ has: page.getByRole('heading', { name: 'Gợi ý cho bạn', exact: true }) });
  let question, answerOne, answerTwo;
  async function login(user) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(45000);
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(site + '/login', { waitUntil: 'domcontentloaded' });
    await page.locator('[name=email]').fill(user.email);
    await page.locator('[name=password]').fill('PtitDemo@2026');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.waitForURL(site + '/');
    return page;
  }
  async function post(page, route, button) {
    const response = page.waitForResponse(
      (res) => res.url().endsWith('/api/v1' + route) && res.request().method() === 'POST'
    );
    await button.click();
    const result = await response;
    assert.equal(result.status(), 201, await result.text());
    return (await result.json()).data;
  }
  async function mutation(page, route, action, method = 'PUT') {
    const response = page.waitForResponse(
      (res) => res.url().endsWith('/api/v1' + route) && res.request().method() === method
    );
    await action();
    assert.equal((await response).status(), 200);
  }
  async function search(values = {}) {
    await first.goto(site + '/questions');
    await first.getByLabel('Tìm kiếm', { exact: true }).waitFor();
    await first.getByLabel('Tìm kiếm', { exact: true }).fill(values.q || '');
    await first.getByLabel('Môn học', { exact: true }).selectOption(values.subject || '');
    await first.getByLabel('Thẻ chủ đề', { exact: true }).fill(values.tags || '');
    await first.getByLabel('Trạng thái', { exact: true }).selectOption(values.status || '');
    await first.getByLabel('Từ ngày', { exact: true }).fill(values.from || '');
    await first.getByLabel('Đến ngày', { exact: true }).fill(values.to || '');
    const response = first.waitForResponse(
      (res) => res.url().includes('/api/v1/academic/questions?') && res.request().method() === 'GET'
    );
    await first.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
    const data = await (await response).json();
    await first
      .getByRole('heading', { name: 'Danh sách câu hỏi (' + data.total + ')', exact: true })
      .waitFor();
    return data;
  }
  async function saveInterests(subject, tags) {
    await first.goto(site + '/questions/interests');
    await first.getByRole('button', { name: 'Lưu lĩnh vực quan tâm', exact: true }).waitFor();
    for (const box of await first.locator('main input[type=checkbox]').all()) await box.uncheck();
    if (subject) await first.getByLabel(subject, { exact: true }).check();
    await first.getByLabel('Thẻ chủ đề', { exact: true }).fill(tags || '');
    await mutation(first, '/academic/interests', () =>
      first.getByRole('button', { name: 'Lưu lĩnh vực quan tâm', exact: true }).click()
    );
    await first.getByText('Đã lưu lĩnh vực quan tâm.', { exact: true }).waitFor();
    await first
      .getByRole('navigation', { name: 'Điều hướng hỏi đáp' })
      .getByRole('link', { name: 'Hỏi đáp học thuật', exact: true })
      .click();
    await recommendations(first).locator('article').first().waitFor();
  }
  try {
    first = await login(a);
    second = await login(b);
    await first.goto(site + '/questions/new');
    const publish = first.getByRole('button', { name: 'Đăng câu hỏi', exact: true });
    const titleInput = first.getByLabel('Tiêu đề', { exact: true });
    const bodyInput = first.getByLabel(/Mô tả vấn đề/);
    await titleInput.waitFor();
    await check(1, 'Bỏ trống tiêu đề/nội dung/môn học không thể đăng', async () => {
      await publish.click();
      assert.equal(await titleInput.evaluate((el) => el.validity.valid), false);
      await titleInput.fill(title);
      await publish.click();
      assert.equal(
        await first.getByLabel('Môn học', { exact: true }).evaluate((el) => el.validity.valid),
        false
      );
      await first.getByLabel('Môn học', { exact: true }).selectOption('web');
      await publish.click();
      assert.equal(await bodyInput.evaluate((el) => el.validity.valid), false);
      assert(first.url().endsWith('/questions/new'));
    });
    await bodyInput.fill(body);
    await first.getByLabel('Thẻ chủ đề', { exact: true }).fill(marker + ', mongodb');
    await check(1, 'Form văn bản không còn công cụ đính kèm và xem trước', async () => {
      assert.equal(await first.locator('input[type=file]').count(), 0);
      for (const name of ['Chọn ảnh', 'Chèn đoạn mã', 'Chèn liên kết', 'Xem trước'])
        assert.equal(await first.getByRole('button', { name, exact: true }).count(), 0);
    });
    await check(1, 'Đăng hợp lệ, chuyển trang chi tiết và mặc định Chưa giải quyết', async () => {
      question = await post(first, '/academic/questions', publish);
      await first.waitForURL(site + '/questions/' + question._id);
      await first.getByRole('heading', { name: title, exact: true }).waitFor();
      await first.getByText('Chưa giải quyết', { exact: true }).waitFor();
      assert.deepEqual(question.tags, [marker, 'mongodb']);
    });
    const url = site + '/questions/' + question._id;
    await check(1, 'Tải lại vẫn giữ nội dung, môn học, thẻ và trạng thái', async () => {
      await first.reload();
      await first.getByRole('heading', { name: title, exact: true }).waitFor();
      await first.getByText('Lập trình Web', { exact: true }).waitFor();
      await first.getByText('#' + marker, { exact: true }).waitFor();
      await first.getByText('Chưa giải quyết', { exact: true }).waitFor();
      assert((await first.locator('main').innerText()).includes(bodyWord));
    });
    await check(
      1,
      'API kiểm tra biên tiêu đề 10/200, nội dung 20/20000 và tối đa 5 thẻ',
      async () => {
        const valid = {
          title: 'a'.repeat(10),
          body: 'b'.repeat(20),
          subject: 'web',
          tags: ['one', 'two', 'three', 'four', 'five'],
        };
        const min = (await api('POST', '/academic/questions', a, valid, 201)).data;
        assert.equal(min.title.length, 10);
        assert.equal(min.body.length, 20);
        assert.equal(min.tags.length, 5);
        const max = (
          await api(
            'POST',
            '/academic/questions',
            a,
            { ...valid, title: 't'.repeat(200), body: 'c'.repeat(20000) },
            201
          )
        ).data;
        assert.equal(max.title.length, 200);
        assert.equal(max.body.length, 20000);
        for (const override of [
          { title: '' },
          { title: 'a'.repeat(9) },
          { title: 'a'.repeat(201) },
          { body: '' },
          { body: 'b'.repeat(19) },
          { body: 'b'.repeat(20001) },
          { subject: '' },
          { tags: [...valid.tags, 'six'] },
        ]) {
          await api('POST', '/academic/questions', a, { ...valid, ...override }, 400);
        }
      }
    );
    await check(3, 'A không có form tự trả lời; API cũng từ chối tự trả lời', async () => {
      await first.getByRole('heading', { name: title, exact: true }).waitFor();
      assert.equal(await first.getByLabel(/Nội dung câu trả lời/).count(), 0);
      await api(
        'POST',
        '/academic/questions/' + question._id + '/answers',
        a,
        { body: 'Tôi tự trả lời câu hỏi của mình.' },
        403
      );
    });
    await check(
      3,
      'B trả lời, A tải lại thấy đúng tác giả/thời gian và vẫn Chưa giải quyết',
      async () => {
        await second.goto(url);
        await second.getByLabel(/Nội dung câu trả lời/).fill('Câu trả lời đầu tiên của B ' + tag);
        answerOne = await post(
          second,
          '/academic/questions/' + question._id + '/answers',
          second.getByRole('button', { name: 'Gửi câu trả lời', exact: true })
        );
        await first.reload();
        const answer = first.getByRole('article', { name: 'Câu trả lời', exact: true });
        await answer.getByText(answerOne.body, { exact: true }).waitFor();
        assert.equal(
          await answer.locator('a[href="/profile/' + b.username + '"]').innerText(),
          b.last_name + ' ' + b.first_name
        );
        assert.equal(await answer.locator('time').getAttribute('datetime'), answerOne.createdAt);
        assert.match(await answer.locator('time').innerText(), /\d{2}:\d{2}.*\d{2}\/\d{2}\/\d{4}/);
        await first.getByText('Chưa giải quyết', { exact: true }).waitFor();
      }
    );
    await check(3, 'A và B thảo luận, bình luận rỗng bị chặn trên UI/API', async () => {
      for (const [page, user, text] of [
        [first, a, 'Trao đổi của A ' + tag],
        [second, b, 'Trao đổi của B ' + tag],
      ]) {
        const answer = page.getByRole('article', { name: 'Câu trả lời', exact: true });
        await answer.getByRole('button', { name: /^Thảo luận/ }).click();
        await answer.getByLabel('Bình luận', { exact: true }).waitFor();
        await answer.getByRole('button', { name: 'Gửi bình luận', exact: true }).click();
        assert.equal(
          await answer.getByLabel('Bình luận', { exact: true }).evaluate((el) => el.validity.valid),
          false
        );
        await api(
          'POST',
          '/academic/answers/' + answerOne._id + '/comments',
          user,
          { body: '' },
          400
        );
        await answer.getByLabel('Bình luận', { exact: true }).fill(text);
        await post(
          page,
          '/academic/answers/' + answerOne._id + '/comments',
          answer.getByRole('button', { name: 'Gửi bình luận', exact: true })
        );
        await answer.getByText(text, { exact: true }).waitFor();
      }
      const comments = (await api('GET', '/academic/answers/' + answerOne._id + '/comments', a))
        .data;
      assert.deepEqual(
        comments.map((item) => item.author._id),
        [a._id, b._id]
      );
      assert(comments.every((item) => Number.isFinite(Date.parse(item.createdAt))));
    });
    await check(4, 'A bình chọn tăng 1; tải lại giữ lượt và trạng thái', async () => {
      const vote = first.getByRole('button', { name: 'Hữu ích (0)', exact: true });
      await vote.click();
      await first.getByRole('button', { name: 'Hữu ích (1)', exact: true }).waitFor();
      await first.reload();
      const saved = first.getByRole('button', { name: 'Hữu ích (1)', exact: true });
      await saved.waitFor();
      assert.equal(await saved.getAttribute('aria-pressed'), 'true');
    });
    await check(4, 'Bấm lại hủy bình chọn, tải lại giữ 0 lượt', async () => {
      await first.getByRole('button', { name: 'Hữu ích (1)', exact: true }).click();
      await first.getByRole('button', { name: 'Hữu ích (0)', exact: true }).waitFor();
      await first.reload();
      const vote = first.getByRole('button', { name: 'Hữu ích (0)', exact: true });
      await vote.waitFor();
      assert.equal(await vote.getAttribute('aria-pressed'), 'false');
    });
    await check(4, 'B không thể tự bình chọn trên UI và API', async () => {
      await second.reload();
      const vote = second.getByRole('button', { name: 'Hữu ích (0)', exact: true });
      await vote.waitFor();
      assert(await vote.isDisabled());
      await api('PUT', '/academic/answers/' + answerOne._id + '/helpful', b, {}, 403);
    });
    await check(5, 'Chọn lời giải chuyển Đã giải quyết, đưa lên đầu và không trùng', async () => {
      await first.getByRole('button', { name: 'Chọn làm lời giải', exact: true }).click();
      await first.getByText('Đã giải quyết', { exact: true }).waitFor();
      const accepted = first.getByRole('article', { name: 'Lời giải được chọn', exact: true });
      await accepted.waitFor();
      assert.equal(await first.getByText(answerOne.body, { exact: true }).count(), 1);
      assert.equal(
        await first.getByRole('article', { name: 'Câu trả lời', exact: true }).count(),
        0
      );
      assert.equal(
        (await api('GET', '/academic/questions/' + question._id, a)).data.acceptedAnswer._id,
        answerOne._id
      );
    });
    await check(
      5,
      'B gửi câu trả lời thứ hai, A đổi lời giải và chỉ một câu được chọn',
      async () => {
        await second.getByLabel(/Nội dung câu trả lời/).fill('Câu trả lời thứ hai của B ' + tag);
        answerTwo = await post(
          second,
          '/academic/questions/' + question._id + '/answers',
          second.getByRole('button', { name: 'Gửi câu trả lời', exact: true })
        );
        await first.reload();
        const secondAnswer = first
          .getByRole('article', { name: 'Câu trả lời', exact: true })
          .filter({ hasText: answerTwo.body });
        await secondAnswer.getByRole('button', { name: 'Chọn làm lời giải', exact: true }).click();
        const selected = first.getByRole('article', { name: 'Lời giải được chọn', exact: true });
        await selected.getByText(answerTwo.body, { exact: true }).waitFor();
        assert.equal(await selected.count(), 1);
        assert.equal(await first.getByText(answerOne.body, { exact: true }).count(), 1);
        assert.equal(await first.getByText(answerTwo.body, { exact: true }).count(), 1);
        const answerOrder = await first.locator('main > article[aria-label]').allTextContents();
        assert(answerOrder[0].includes(answerTwo.body));
      }
    );
    await check(5, 'B không được chọn/bỏ lời giải trên UI và API', async () => {
      await second.reload();
      await second.getByRole('article', { name: 'Lời giải được chọn', exact: true }).waitFor();
      assert.equal(
        await second.getByRole('button', { name: /Chọn làm lời giải|Bỏ chọn lời giải/ }).count(),
        0
      );
      for (const answerId of [answerOne._id, null])
        await api(
          'PUT',
          '/academic/questions/' + question._id + '/accepted-answer',
          b,
          { answerId },
          403
        );
    });
    await check(5, 'Bỏ lời giải trở về Chưa giải quyết, không mất câu trả lời', async () => {
      await first.getByRole('button', { name: 'Bỏ chọn lời giải', exact: true }).click();
      await first.getByText('Chưa giải quyết', { exact: true }).waitFor();
      assert.equal(
        await first.getByRole('article', { name: 'Lời giải được chọn', exact: true }).count(),
        0
      );
      assert.equal(
        await first.getByRole('article', { name: 'Câu trả lời', exact: true }).count(),
        2
      );
      await first.screenshot({
        path: path.join(folder, 'answers-and-permissions.png'),
        fullPage: true,
      });
    });

    // Distinct fixtures make each search/filter expectation independent of user data.
    const makeQuestion = async (data) =>
      (
        await api(
          'POST',
          '/academic/questions',
          a,
          {
            title: 'Câu hỏi kiểm thử ' + tag,
            body: 'Nội dung câu hỏi phục vụ kiểm tra chức năng học thuật.',
            subject: 'web',
            tags: [marker],
            ...data,
          },
          201
        )
      ).data;
    const algorithm = await makeQuestion({
      title: 'Giải thuật kiểm thử ' + tag,
      subject: 'algorithms',
      tags: [marker, 'sapxep'],
    });
    const database = await makeQuestion({
      title: 'Cơ sở dữ liệu kiểm thử ' + tag,
      subject: 'databases',
      tags: [marker, 'csdl' + tag],
    });
    await api('PUT', '/academic/questions/' + question._id + '/accepted-answer', a, {
      answerId: answerTwo._id,
    });
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(question.createdAt));
    await check(6, 'Tìm riêng từ trong tiêu đề và từ chỉ có trong nội dung', async () => {
      for (const q of [titleWord, bodyWord]) {
        const response = await search({ q });
        assert.deepEqual(
          response.data.map((item) => item._id),
          [question._id]
        );
        await cards(first).getByRole('link', { name: title, exact: true }).waitFor();
      }
    });
    await check(6, 'Lọc môn học, thẻ, trạng thái và khoảng ngày', async () => {
      for (const [values, expected] of [
        [{ tags: marker, subject: 'algorithms' }, [algorithm._id]],
        [{ tags: 'csdl' + tag }, [database._id]],
        [{ tags: marker, status: 'resolved' }, [question._id]],
        [{ tags: marker, status: 'unresolved' }, [database._id, algorithm._id]],
        [{ tags: marker, from: today, to: today }, [database._id, algorithm._id, question._id]],
        [{ tags: marker, from: '2000-01-01', to: '2000-01-02' }, []],
      ])
        assert.deepEqual(
          (await search(values)).data.map((item) => item._id),
          expected
        );
    });
    const combined = {
      q: titleWord,
      subject: 'web',
      tags: 'mongodb',
      status: 'resolved',
      from: today,
      to: today,
    };
    await check(6, 'Kết hợp tất cả bộ lọc; tải lại giữ nguyên bộ lọc', async () => {
      assert.deepEqual(
        (await search(combined)).data.map((item) => item._id),
        [question._id]
      );
      await first.reload();
      await cards(first).getByRole('link', { name: title, exact: true }).waitFor();
      for (const [name, value] of Object.entries(combined))
        assert.equal(await first.locator('main [name=' + name + ']').inputValue(), value);
      await first.screenshot({ path: path.join(folder, 'combined-filters.png'), fullPage: true });
    });
    await check(
      6,
      'Không có kết quả có thông báo rõ ràng; Xóa bộ lọc trở về danh sách chung',
      async () => {
        assert.equal((await search({ ...combined, subject: 'algorithms' })).total, 0);
        await first
          .getByText('Không có câu hỏi phù hợp. Hãy thử bộ lọc khác hoặc đặt câu hỏi mới.', {
            exact: true,
          })
          .waitFor();
        await first.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
        await first.waitForURL(site + '/questions');
        const all = await api('GET', '/academic/questions', a);
        await first
          .getByRole('heading', { name: 'Danh sách câu hỏi (' + all.total + ')', exact: true })
          .waitFor();
        for (const name of ['q', 'subject', 'tags', 'status', 'from', 'to'])
          assert.equal(await first.locator('main [name=' + name + ']').inputValue(), '');
      }
    );
    await check(
      6,
      '23 câu hỏi: trang 1 có 20, trang 2 có 3, không trùng và quay lại được',
      async () => {
        const pageTag = 'page' + tag;
        for (let i = 1; i <= 23; i++)
          await makeQuestion({
            title: 'Phân trang ' + tag + ' số ' + i,
            tags: [pageTag],
            subject: 'other',
          });
        const response = await search({ tags: pageTag });
        assert.equal(response.total, 23);
        assert.equal(await cards(first).count(), 20);
        const firstIds = response.data.map((item) => item._id);
        const next = first.waitForResponse(
          (res) => res.url().includes('/academic/questions?') && res.url().includes('page=2')
        );
        await first
          .getByRole('navigation', { name: 'Phân trang', exact: true })
          .getByRole('button', { name: 'Trang sau', exact: true })
          .click();
        const pageTwo = await (await next).json();
        await first.getByText('Trang 2 / 2', { exact: true }).waitFor();
        assert.equal(await cards(first).count(), 3);
        assert.equal(pageTwo.data.length, 3);
        assert(pageTwo.data.every((item) => !firstIds.includes(item._id)));
        await first.reload();
        await first.getByText('Trang 2 / 2', { exact: true }).waitFor();
        await first.getByRole('button', { name: 'Trang trước', exact: true }).click();
        await first.getByText('Trang 1 / 2', { exact: true }).waitFor();
        assert.equal(await cards(first).count(), 20);
      }
    );
    await check(7, 'Lưu sở thích môn/thẻ và ưu tiên câu hỏi phù hợp', async () => {
      await saveInterests('Lập trình Web', marker + ', mongodb');
      const saved = (await api('GET', '/academic/interests', a)).data;
      assert.deepEqual(saved, { subjects: ['web'], tags: [marker, 'mongodb'] });
      assert.equal(await recommendations(first).locator('article h3 a').first().innerText(), title);
      await first.reload();
      await recommendations(first).locator('article').first().waitFor();
      assert.equal(await recommendations(first).locator('article h3 a').first().innerText(), title);
    });
    await check(7, 'Đổi sở thích thì gợi ý đổi theo môn và thẻ mới', async () => {
      await saveInterests('Cấu trúc dữ liệu và Giải thuật', 'sapxep');
      assert.equal(
        await recommendations(first).locator('article h3 a').first().innerText(),
        algorithm.title
      );
    });
    await check(7, 'Xóa hết sở thích hoặc thẻ không khớp trả câu hỏi mới nhất', async () => {
      for (const tags of ['', 'unmatched' + tag]) {
        await saveInterests(null, tags);
        const newest = (await api('GET', '/academic/questions?limit=6', a)).data.map(
          (item) => item._id
        );
        const suggested = (await api('GET', '/academic/questions/recommended', a)).data.map(
          (item) => item._id
        );
        assert.deepEqual(suggested, newest);
        const links = await recommendations(first)
          .locator('article h3 a')
          .evaluateAll((elements) =>
            elements.map((el) => el.getAttribute('href').split('/').pop())
          );
        assert.deepEqual(links, newest);
      }
      await first.screenshot({ path: path.join(folder, 'recommendations.png'), fullPage: true });
    });
    await check(7, 'Không có lỗi JavaScript trong toàn bộ quy trình trình duyệt', async () =>
      assert.deepEqual(errors, [])
    );
  } catch (error) {
    for (const [index, page] of [first, second].entries())
      if (page) {
        await page
          .screenshot({ path: path.join(folder, 'failure-' + index + '.png'), fullPage: true })
          .catch(() => {});
      }
    throw error;
  } finally {
    await fs.writeFile(
      path.join(folder, 'report.json'),
      JSON.stringify({ time: new Date().toISOString(), results }, null, 2)
    );
    await browser.close();
  }
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
