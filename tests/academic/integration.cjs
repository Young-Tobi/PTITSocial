const assert = require('node:assert/strict');
const { MongoClient, ObjectId } = require('mongodb');
const base = process.env.TEST_API_URL || 'http://localhost:8000';
const mail = process.env.TEST_MAIL_URL || 'http://localhost:8025';
async function run(browserCheck) {
  const tag = Date.now();
  const users = [];
  const emails = [];
  const mailIds = [];
  const client = new MongoClient(process.env.TEST_MONGO_URL || 'mongodb://127.0.0.1:27017');
  await client.connect();
  async function api(method, route, user, body, expected = 200) {
    const form = body instanceof FormData;
    const response = await fetch(base + '/api/v1' + route, {
      method,
      headers: {
        ...(user ? { authorization: 'Bearer ' + user.token } : {}),
        ...(!form && body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: form ? body : body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    assert.equal(response.status, expected, method + ' ' + route + ': ' + data.message);
    return data;
  }
  async function account(index) {
    const email = 'academic-' + tag + '-' + index + '@example.com';
    emails.push(email);
    const result = await api('POST', '/users/signup', null, {
      first_name: 'Academic',
      last_name: 'Student',
      email,
      password: 'PtitDemo@2026',
      passwordConfirm: 'PtitDemo@2026',
      gender: 'male',
      birth_Year: 2003,
      birth_Month: 1,
      birth_Day: 15,
    });
    const user = { ...result.data.user, token: result.data.token, email };
    users.push(user);
    const inbox = await (await fetch(mail + '/api/v1/messages?limit=200')).json();
    const message = inbox.messages.find((m) => m.To.some((to) => to.Address === email));
    assert(message, 'Verification mail missing');
    mailIds.push(message.ID);
    const detail = await (await fetch(mail + '/api/v1/message/' + message.ID)).json();
    const token = (detail.Text || detail.HTML).match(/\/activate\/([a-f0-9]+)/)[1];
    await api('GET', '/academic/questions', user, undefined, 403);
    await api('POST', '/users/emailVerification', user, { token }, 201);
    return user;
  }
  const body = 'Lỗi kết nối MongoDB từ Node.js.\n  Đã kiểm tra địa chỉ và cổng kết nối.';
  try {
    await api('GET', '/academic/questions', null, undefined, 401);
    const a = await account('a'),
      b = await account('b'),
      c = await account('c');
    const q = (
      await api(
        'POST',
        '/academic/questions',
        a,
        {
          title: 'Lỗi kết nối MongoDB trong Node.js ' + tag,
          body,
          subject: 'web',
          tags: ['MongoDB', 'node.js'],
        },
        201
      )
    ).data;
    assert.equal(q.author, a._id);
    assert.equal(q.body, body);
    assert.deepEqual(q.tags, ['mongodb', 'node.js']);
    assert.equal(Object.hasOwn(q, 'images'), false);
    const second = (
      await api(
        'POST',
        '/academic/questions',
        c,
        {
          title: 'Câu hỏi khác về thuật toán ' + tag,
          body: 'Cần giải thích độ phức tạp của thuật toán sắp xếp.',
          subject: 'algorithms',
          tags: [],
          author: a._id,
        },
        201
      )
    ).data;
    assert.equal(second.author, c._id);
    console.log('PASS authentication, text question and server-owned author');
    await api(
      'POST',
      '/academic/questions/' + q._id + '/answers',
      a,
      { body: 'Tự trả lời câu hỏi của tôi' },
      403
    );
    const answer = (
      await api(
        'POST',
        '/academic/questions/' + q._id + '/answers',
        b,
        { body: 'Kiểm tra chuỗi kết nối và dịch vụ MongoDB đang chạy.' },
        201
      )
    ).data;
    const another = (
      await api(
        'POST',
        '/academic/questions/' + q._id + '/answers',
        c,
        { body: 'Kiểm tra cổng kết nối và tên database trong cấu hình.' },
        201
      )
    ).data;
    const foreign = (
      await api(
        'POST',
        '/academic/questions/' + second._id + '/answers',
        b,
        { body: 'Độ phức tạp của thuật toán phụ thuộc vào dữ liệu đầu vào.' },
        201
      )
    ).data;
    await api(
      'POST',
      '/academic/answers/' + answer._id + '/comments',
      a,
      { body: 'Mình đang dùng localhost:27017.' },
      201
    );
    await api(
      'POST',
      '/academic/answers/' + answer._id + '/comments',
      b,
      { body: 'Bạn thử dùng 127.0.0.1 nhé.' },
      201
    );
    assert.equal((await api('GET', '/academic/answers/' + answer._id + '/comments', a)).total, 2);
    assert.equal((await api('GET', '/academic/questions/' + q._id, a)).data.resolved, false);
    await api('PUT', '/academic/answers/' + answer._id + '/helpful', b, {}, 403);
    await Promise.all(
      Array.from({ length: 8 }, () =>
        api('PUT', '/academic/answers/' + answer._id + '/helpful', a, {})
      )
    );
    assert.equal(
      (await api('PUT', '/academic/answers/' + answer._id + '/helpful', a, {})).data.helpfulCount,
      1
    );
    assert.equal(
      (await api('DELETE', '/academic/answers/' + answer._id + '/helpful', a)).data.helpfulCount,
      0
    );
    await api('DELETE', '/academic/answers/' + answer._id + '/helpful', a);
    await api('PUT', '/academic/answers/' + answer._id + '/helpful', a, {});
    await api(
      'PUT',
      '/academic/questions/' + q._id + '/accepted-answer',
      b,
      { answerId: answer._id },
      403
    );
    await api(
      'PUT',
      '/academic/questions/' + q._id + '/accepted-answer',
      a,
      { answerId: foreign._id },
      400
    );
    for (const answerId of [answer._id, another._id, null, answer._id]) {
      await api('PUT', '/academic/questions/' + q._id + '/accepted-answer', a, { answerId });
      const detail = (await api('GET', '/academic/questions/' + q._id, a)).data;
      assert.equal(detail.acceptedAnswer?._id || null, answerId);
      assert.equal(detail.resolved, !!answerId);
      const rest = await api('GET', '/academic/questions/' + q._id + '/answers', a);
      assert(!rest.data.some((item) => item._id === answerId));
    }
    console.log(
      'PASS replies, comments, concurrent votes and select/change/clear solution permissions'
    );
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
      new Date()
    );
    const filter = new URLSearchParams({
      q: String(tag),
      subject: 'web',
      tags: 'mongodb',
      status: 'resolved',
      from: date,
      to: date,
      limit: '1',
    });
    const found = await api('GET', '/academic/questions?' + filter, a);
    assert.equal(found.total, 1);
    assert.equal(found.data[0]._id, q._id);
    assert.equal((await api('GET', '/academic/questions?' + filter + '&page=2', a)).data.length, 0);
    await api('PUT', '/academic/interests', a, { subjects: ['web'], tags: ['MongoDB'] });
    assert.equal((await api('GET', '/academic/questions/recommended', a)).data[0]._id, q._id);
    const publicProfile = await api('GET', '/users/getProfile/' + a.username, b);
    assert.equal(publicProfile.data.user.academicInterests, undefined);
    await api('PUT', '/academic/interests', a, {
      subjects: [],
      tags: ['unmatched-' + tag],
    });
    assert.equal((await api('GET', '/academic/questions/recommended', a)).data[0]._id, second._id);
    await api('PUT', '/academic/interests', a, { subjects: [], tags: [] });
    assert.equal((await api('GET', '/academic/questions/recommended', a)).data[0]._id, second._id);
    console.log(
      'PASS combined search/filters/pagination, interests privacy and recommendations fallback'
    );
    for (const route of [
      '/academic/questions/bad',
      '/academic/questions?page=0',
      '/academic/questions?limit=51',
      '/academic/questions?from=2026-02-30',
      '/academic/questions?q[$ne]=',
      '/academic/questions?status=bad',
    ]) {
      await api('GET', route, a, undefined, 400);
    }
    await api('GET', '/academic/questions/' + new ObjectId(), a, undefined, 404);
    await api('POST', '/academic/questions', a, { title: 'bad', body, subject: 'web' }, 400);
    await api('POST', '/academic/answers/' + answer._id + '/comments', a, { body: {} }, 400);
    const count = await client
      .db('ptitsocial_content')
      .collection('questions')
      .countDocuments({ author: new ObjectId(a._id) });
    const multipart = new FormData();
    multipart.set('title', 'Unsupported attachment');
    multipart.set('body', body);
    multipart.set('subject', 'web');
    multipart.append('images', new Blob(['file'], { type: 'image/png' }), 'image.png');
    await api('POST', '/academic/questions', a, multipart, 415);
    await api(
      'POST',
      '/academic/questions',
      a,
      {
        title: 'Unsupported attachment',
        body,
        subject: 'web',
        images: ['https://example.test/image.png'],
      },
      400
    );
    assert.equal(
      await client
        .db('ptitsocial_content')
        .collection('questions')
        .countDocuments({ author: new ObjectId(a._id) }),
      count
    );
    console.log(
      'PASS malformed input, missing records and rejected attachments without partial questions'
    );
    if (browserCheck) await browserCheck({ a, b, c, q, answer, api, tag });
  } finally {
    const created = await client
      .db('ptitsocial_accounts')
      .collection('users')
      .find({ email: { $in: emails } })
      .project({ _id: 1 })
      .toArray();
    const ids = created.map((u) => u._id);
    if (ids.length) {
      const content = client.db('ptitsocial_content');
      await content.collection('academic_interests').deleteMany({ user: { $in: ids } });
      const answers = await content
        .collection('answers')
        .find({ author: { $in: ids } })
        .toArray();
      await content.collection('answervotes').deleteMany({
        $or: [{ user: { $in: ids } }, { answer: { $in: answers.map((a) => a._id) } }],
      });
      await content.collection('answercomments').deleteMany({ author: { $in: ids } });
      await content.collection('answers').deleteMany({ author: { $in: ids } });
      await content.collection('questions').deleteMany({ author: { $in: ids } });
      await client
        .db('ptitsocial_messaging')
        .collection('notifications')
        .deleteMany({
          $or: [{ sender: { $in: ids } }, { recipient: { $in: ids } }],
        });
      await client
        .db('ptitsocial_accounts')
        .collection('users')
        .deleteMany({ _id: { $in: ids } });
      for (const db of ['ptitsocial_content', 'ptitsocial_messaging'])
        await client
          .db(db)
          .collection('user_projections')
          .deleteMany({ _id: { $in: ids } });
    }
    await client.close();
    const inbox = await (await fetch(mail + '/api/v1/messages?limit=200')).json();
    for (const message of inbox.messages)
      if (message.To.some((to) => emails.includes(to.Address)) && !mailIds.includes(message.ID))
        mailIds.push(message.ID);
    if (mailIds.length)
      await fetch(mail + '/api/v1/messages', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ IDs: mailIds }),
      });
  }
}
module.exports = { run };
if (require.main === module)
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
