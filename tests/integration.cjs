const assert = require('node:assert/strict');
const { MongoClient, ObjectId } = require('mongodb');
const sharp = require('sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const { io } = require('../apps/web/node_modules/socket.io-client');
const base = process.env.TEST_API_URL || 'http://localhost:8000';
const tag = Date.now();
const ids = [];
const sockets = [];
const fixtureImages = [];
const mailIds = [];
async function api(method, pathname, { token, body, form, expected } = {}) {
  const response = await fetch(base + pathname, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: form || (body ? JSON.stringify(body) : undefined),
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json();
  if (expected) assert.equal(response.status, expected, JSON.stringify(data));
  else assert(response.ok, `${method} ${pathname}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}
async function account(index, names = {}) {
  const email = `architecture-${tag}-${index}@example.com`.toLowerCase();
  const result = await api('POST', '/api/v1/users/signup', {
    body: {
      first_name: 'Integration',
      last_name: 'Student' + index,
      ...names,
      email,
      password: 'PtitDemo@2026',
      passwordConfirm: 'PtitDemo@2026',
      gender: 'male',
      birth_Year: 2003,
      birth_Month: 1,
      birth_Day: 15,
    },
  });
  const user = { ...result.data.user, token: result.data.token, email };
  ids.push(new ObjectId(user._id));
  return user;
}
async function activate(user) {
  const inbox = await (await fetch('http://localhost:8025/api/v1/messages?limit=100')).json();
  const email = inbox.messages.find((message) =>
    message.To.some((to) => to.Address === user.email)
  );
  assert(email, 'Verification email must arrive');
  mailIds.push(email.ID);
  const detail = await (await fetch('http://localhost:8025/api/v1/message/' + email.ID)).json();
  const verificationToken = (detail.Text || detail.HTML).match(/\/activate\/([a-f0-9]+)/)[1];
  await api('POST', '/api/v1/users/emailVerification', {
    token: user.token,
    body: { token: verificationToken },
  });
}
async function connect(user) {
  const socket = io(base, {
    auth: { token: user.token },
    transports: ['websocket'],
    reconnection: false,
  });
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket connection timeout')), 8000);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.emit('setup', {});
      resolve();
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  return socket;
}
async function main() {
  const health = await api('GET', '/health');
  assert.deepEqual(health.services, {
    accounts: 'ok',
    content: 'ok',
    messaging: 'ok',
    quiz: 'ok',
    coding: 'ok',
    study: 'ok',
    learning: 'ok',
  });
  const first = await account('One');
  const second = await account('Two');
  await api('GET', '/api/v1/posts/getAllPosts', { token: first.token, expected: 403 });
  await activate(first);
  await activate(second);
  console.log('PASS signup and email verification across services');

  await api('PUT', `/api/v1/friends/add/${second._id}`, { token: first.token, body: {} });
  const pending = await api('GET', '/api/v1/friends/friendsPage', { token: second.token });
  const invitation = pending.data.recivedRequests.find(
    (request) => request.sender._id === first._id
  );
  assert(invitation);
  await api('PUT', `/api/v1/friends/acceptRequest/${invitation._id}`, {
    token: second.token,
    body: {},
  });
  const friends = await api('GET', '/api/v1/friends/friendsPage', { token: first.token });
  assert(friends.data.friendLists.some((user) => user._id === second._id));
  console.log('PASS friendship owned by accounts');

  const image = await sharp({
    create: { width: 100, height: 100, channels: 3, background: '#b8202e' },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.set('type', 'image');
  form.set('text', 'Microservices integration check');
  form.set('images', new Blob([image], { type: 'image/png' }), 'check.png');
  const post = (await api('POST', '/api/v1/posts/createPost/images', { token: first.token, form }))
    .data;
  assert((await fetch(post.images[0])).ok);
  fixtureImages.push(post.images[0]);
  const feed = await api('GET', '/api/v1/posts/getAllPosts', { token: second.token });
  assert(feed.data.some((item) => item._id === post._id));
  await api('PUT', `/api/v1/posts/${post._id}/reacts`, {
    token: second.token,
    body: { type: 'like' },
  });
  const commentForm = new FormData();
  commentForm.set('text', 'Cross-service comment');
  await api('POST', `/api/v1/posts/addComment/${post._id}`, {
    token: second.token,
    form: commentForm,
  });
  const notification = await api('GET', '/api/v1/users/notifications', { token: first.token });
  assert(notification.data.notifications.some((item) => item.type === 'comment'));
  console.log('PASS image upload, following feed, reaction, comment and remote notifications');

  const avatar = new FormData();
  avatar.set('photo', new Blob([image], { type: 'image/png' }), 'avatar.png');
  avatar.set('text', 'Updated avatar');
  const updated = await api('POST', '/api/v1/users/update/profile/photo', {
    token: second.token,
    form: avatar,
  });
  assert((await fetch(updated.data.url)).ok);
  fixtureImages.push(updated.data.url);
  const profilePosts = await api('GET', `/api/v1/users/getProfile/${second.username}/posts`, {
    token: first.token,
  });
  assert(profilePosts.data.some((item) => item.type === 'profilePhoto'));
  const photos = await api('GET', `/api/v1/users/getProfile/${second.username}/photos`, {
    token: first.token,
  });
  assert(photos.data.resources.length > 0);
  console.log('PASS account photo update delegated to content storage and profile post');

  const chat = (
    await api('POST', '/api/v1/chats/create/private', {
      token: first.token,
      body: { userId: second._id },
    })
  ).data.chat;
  const sender = await connect(first);
  const recipient = await connect(second);
  const received = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Message relay timeout')), 8000);
    recipient.once('message_recieved', (message) => {
      clearTimeout(timer);
      resolve(message);
    });
  });
  const message = (
    await api('PUT', `/api/v1/messages/${chat._id}/send`, {
      token: first.token,
      body: { type: 'text', content: 'Hello through the API Gateway' },
    })
  ).data.message;
  sender.emit('new_message', { message, chat });
  assert.equal((await received).content, 'Hello through the API Gateway');
  const unread = await api('PUT', '/api/v1/users/ping', { token: second.token, body: {} });
  assert.equal(unread.unseenMessages, 1);
  await api('PUT', `/api/v1/messages/${message._id}/seen`, { token: second.token, body: {} });
  const ping = await api('PUT', '/api/v1/users/ping', { token: second.token, body: {} });
  assert.equal(ping.unseenMessages, 0);
  console.log('PASS real WebSocket upgrade, persisted message, relay and counters');

  await regressions({ first, second, sender, recipient, image, post, message });

  await api('GET', '/internal/projections', { expected: 404 });
  assert.equal(
    (
      await fetch('http://127.0.0.1:8002/internal/media', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
    ).status,
    403
  );
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  try {
    for (const domain of ['content', 'messaging']) {
      const db = client.db('ptitsocial_' + domain);
      assert(!(await db.listCollections({ name: 'users' }).toArray()).length);
      const projection = await db.collection('user_projections').findOne({ _id: ids[0] });
      assert(
        projection && !projection.password && !projection.email && !projection.passwordResetToken
      );
    }
  } finally {
    await client.close();
  }
  console.log('PASS separate databases, secret-free projections and private internal APIs');
}
async function regressions({ first, second, sender, recipient, image, post, message }) {
  const third = await account('Three', { first_name: 'An', last_name: 'Lê' });
  const outsider = await account('Four', { first_name: 'Đỗ', last_name: 'Nguyễn' });
  await activate(third);
  await activate(outsider);
  assert.equal(third.last_name, 'Lê');
  assert.equal(outsider.last_name, 'Nguyễn');
  console.log('PASS Vietnamese names, including two-character names, and verification mail');

  const privateChat = (
    await api('POST', '/api/v1/chats/create/private', {
      token: third.token,
      body: { userId: outsider._id },
    })
  ).data.chat;
  const privateMessage = (
    await api('PUT', `/api/v1/messages/${privateChat._id}/send`, {
      token: third.token,
      body: { type: 'text', content: 'Must remain private to third and outsider' },
    })
  ).data.message;
  const filteredChats = await api('GET', `/api/v1/chats?users=${outsider._id}`, {
    token: first.token,
  });
  assert.equal(filteredChats.data.chats.length, 0, 'Query filters cannot replace chat membership');
  const filteredMessages = await api(
    'GET',
    `/api/v1/messages/${message.chat}?page=1&chat=${privateChat._id}`,
    {
      token: first.token,
    }
  );
  assert.equal(
    filteredMessages.data.messages.length,
    0,
    'Query filters cannot switch message conversations'
  );
  await api('PUT', `/api/v1/messages/${privateMessage._id}/seen`, {
    token: outsider.token,
    body: {},
  });
  console.log(
    'PASS query parameters cannot override chat ownership or expose another conversation'
  );

  await api('GET', '/api/v1/posts/not-an-id', { token: first.token, expected: 400 });
  await api('POST', '/api/v1/chats/create/private', {
    token: first.token,
    body: { userId: 'not-an-id' },
    expected: 400,
  });
  await api('PATCH', '/api/v1/users/resetPassword', { body: {}, expected: 400 });
  console.log('PASS malformed IDs and missing reset credentials return client errors');

  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  try {
    const messages = client.db('ptitsocial_messaging').collection('messages');
    const before = await messages.findOne({ _id: new ObjectId(message._id) });
    const denied = await api('PUT', `/api/v1/messages/${message._id}/seen`, {
      token: outsider.token,
      body: {},
      expected: 403,
    });
    assert.equal(denied.data, undefined);
    assert(!JSON.stringify(denied).includes(message.content));
    assert.deepEqual(await messages.findOne({ _id: before._id }), before);
    await api('PUT', '/api/v1/messages/invalid/seen', {
      token: first.token,
      body: {},
      expected: 400,
    });
    await api('PUT', `/api/v1/messages/${new ObjectId()}/seen`, {
      token: first.token,
      body: {},
      expected: 404,
    });
    console.log('PASS nonmembers cannot read or mutate message receipts; invalid IDs rejected');

    const chat = (
      await api('POST', '/api/v1/chats/create/group', {
        token: first.token,
        body: { users: [second._id, third._id], chatName: 'Read receipt regression' },
      })
    ).data.chat;
    const thirdSocket = await connect(third);
    const unread = async (user) =>
      (
        await api('PUT', '/api/v1/users/ping', {
          token: user.token,
          body: {},
        })
      ).unseenMessages;
    const seen = async (msg, user) =>
      (
        await api('PUT', `/api/v1/messages/${msg._id}/seen`, {
          token: user.token,
          body: {},
        })
      ).data;
    const send = async (text) => {
      const receipts = [recipient, thirdSocket].map(
        (socket) =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Group relay timeout')), 8000);
            socket.once('message_recieved', (saved, stats) => {
              clearTimeout(timer);
              resolve({ saved, stats });
            });
          })
      );
      const saved = (
        await api('PUT', `/api/v1/messages/${chat._id}/send`, {
          token: first.token,
          body: { type: 'text', content: text },
        })
      ).data.message;
      sender.emit('new_message', { message: saved, chat });
      for (const receipt of await Promise.all(receipts)) {
        assert.equal(receipt.saved._id, saved._id);
        assert.equal(receipt.stats.unseenMessages, 1);
      }
      return saved;
    };
    const older = await send('Unread for both recipients');
    assert.deepEqual(await Promise.all([first, second, third, outsider].map(unread)), [0, 1, 1, 0]);
    const groupBefore = await messages.findOne({ _id: new ObjectId(older._id) });
    await api('PUT', `/api/v1/messages/${older._id}/seen`, {
      token: outsider.token,
      body: {},
      expected: 403,
    });
    assert.deepEqual(await messages.findOne({ _id: groupBefore._id }), groupBefore);
    const firstRead = await seen(older, second);
    assert.equal(firstRead.unseenMessages, 0);
    assert.equal(firstRead.message.seen, 'unseen');
    assert.deepEqual(firstRead.message.seenBy, [second._id]);
    assert.equal(await unread(third), 1);
    const latest = await send('A second message in the same conversation');
    assert.equal((await seen(older, second)).unseenMessages, 1);
    const chats = await api('GET', '/api/v1/chats', { token: second.token });
    assert.equal(
      chats.data.chats.find((item) => item._id === chat._id).latestMessage._id,
      latest._id
    );
    await Promise.all([seen(latest, second), seen(latest, second), seen(latest, third)]);
    const readAgain = await seen(latest, second);
    assert.equal(readAgain.unseenMessages, 0);
    assert.equal(readAgain.message.seen, 'seen');
    assert.deepEqual([...readAgain.message.seenBy].sort(), [second._id, third._id].sort());
    assert.deepEqual(await Promise.all([first, second, third, outsider].map(unread)), [0, 0, 0, 0]);
    console.log(
      'PASS group counters, per-user reads, repeated/concurrent reads and older receipts'
    );

    const comments = client.db('ptitsocial_content').collection('comments');
    const filter = { post: new ObjectId(post._id) };
    const initialCount = await comments.countDocuments(filter);
    const photoOnly = new FormData();
    photoOnly.set('photo', new Blob([image], { type: 'image/png' }), 'comment.png');
    const photoComment = (
      await api('POST', `/api/v1/posts/addComment/${post._id}`, {
        token: second.token,
        form: photoOnly,
      })
    ).data.commendData;
    assert.equal(photoComment.text, '');
    assert((await fetch(photoComment.photo)).ok);
    assert.equal(await comments.countDocuments(filter), initialCount + 1);
    for (const text of [null, 123, [], {}, '']) {
      await api('POST', `/api/v1/posts/addComment/${post._id}`, {
        token: second.token,
        body: { text },
        expected: 400,
      });
    }
    await api('POST', `/api/v1/posts/addComment/${post._id}`, {
      token: second.token,
      body: {},
      expected: 400,
    });
    assert.equal(await comments.countDocuments(filter), initialCount + 1);
    console.log('PASS photo-only comment without text; invalid comments never persist');

    const shared = (
      await api('POST', '/api/v1/posts/createPost', {
        token: second.token,
        body: { type: 'share', sharedID: post._id, text: 'Shared caption remains' },
      })
    ).data;
    await api('PUT', `/api/v1/posts/${post._id}`, { token: first.token, body: {} });
    const remaining = (await api('GET', `/api/v1/posts/${shared._id}`, { token: second.token }))
      .data.post;
    assert.equal(remaining.sharedID, null);
    assert.equal(remaining.text, 'Shared caption remains');
    console.log('PASS share stays accessible after deleting the original post');
    await socialRegressions({ first, second, third, outsider, image });
    await passwordResetRegression(outsider);
  } finally {
    await client.close();
  }
}
async function socialRegressions({ first, second, third, outsider, image }) {
  await api('PUT', '/api/v1/users/update/profile/details', {
    token: first.token,
    body: { infos: { bio: 'Student profile audit', college: 'PTIT' } },
  });
  let profile = (
    await api('GET', `/api/v1/users/getProfile/${first.username}`, { token: second.token })
  ).data;
  assert.equal(profile.user.details.bio, 'Student profile audit');
  assert.equal(profile.user.details.college, 'PTIT');
  const cover = new FormData();
  cover.set('photo', new Blob([image], { type: 'image/png' }), 'cover.png');
  const coverResult = await api('POST', '/api/v1/users/update/profile/cover', {
    token: first.token,
    form: cover,
  });
  fixtureImages.push(coverResult.data.url);
  assert((await fetch(coverResult.data.url)).ok);
  const found = await api('POST', '/api/v1/users/search', {
    token: second.token,
    body: { term: first.email },
  });
  assert(found.data.results.some((user) => user._id === first._id));
  await api('POST', '/api/v1/users/search/add', {
    token: second.token,
    body: { searchUser: first._id },
  });
  const history = await api('GET', '/api/v1/users/search', { token: second.token });
  assert(history.data.results.some((item) => item._id === first._id));
  await api('POST', '/api/v1/users/search/remove', {
    token: second.token,
    body: { searchUser: first._id },
  });
  assert(
    !(await api('GET', '/api/v1/users/search', { token: second.token })).data.results.some(
      (item) => item._id === first._id
    )
  );
  console.log('PASS profile details, cover upload, search and search-history add/remove');

  const post = (
    await api('POST', '/api/v1/posts/createPost', {
      token: first.token,
      body: { type: 'normal', text: 'Extended social audit' },
    })
  ).data;
  const comment = (
    await api('POST', `/api/v1/posts/addComment/${post._id}`, {
      token: second.token,
      body: { text: 'Comment for reply and likes' },
    })
  ).data.commendData;
  const likes = (
    await api('PUT', `/api/v1/posts/comments/${comment._id}/like`, { token: first.token, body: {} })
  ).data.likes;
  assert(likes.includes(first._id));
  const unliked = (
    await api('PUT', `/api/v1/posts/comments/${comment._id}/like`, { token: first.token, body: {} })
  ).data.likes;
  assert(!unliked.includes(first._id));
  const reply = (
    await api('POST', `/api/v1/posts/comments/${comment._id}/reply`, {
      token: first.token,
      body: { text: 'Reply audit' },
    })
  ).data.replies;
  assert(reply.some((item) => item.text === 'Reply audit' && item.user._id === first._id));
  await api('PUT', `/api/v1/posts/${post._id}`, { token: second.token, body: {}, expected: 404 });
  const notifications = (await api('GET', '/api/v1/users/notifications', { token: first.token }))
    .data.notifications;
  const notice = notifications.find((item) => item.type === 'comment');
  assert(notice);
  await api('PUT', `/api/v1/users/notifications/${notice._id}/seen`, {
    token: second.token,
    body: {},
    expected: 404,
  });
  await api('PUT', `/api/v1/users/notifications/${notice._id}/seen`, {
    token: first.token,
    body: {},
  });
  await api('PUT', `/api/v1/posts/${post._id}`, { token: first.token, body: {} });
  await api('GET', `/api/v1/posts/${post._id}`, { token: first.token, expected: 404 });
  console.log(
    'PASS comment like/unlike, replies, notification ownership/read state and post delete permissions'
  );

  await api('PUT', `/api/v1/friends/add/${third._id}`, { token: first.token, body: {} });
  profile = (await api('GET', `/api/v1/users/getProfile/${third.username}`, { token: first.token }))
    .data;
  const requestId = profile.friendship.requestID;
  assert(profile.friendship.requestSent);
  await api('PUT', `/api/v1/friends/cancel/${requestId}`, { token: first.token, body: {} });
  profile = (await api('GET', `/api/v1/users/getProfile/${third.username}`, { token: first.token }))
    .data;
  assert(!profile.friendship.requestSent);
  await api('PUT', `/api/v1/friends/add/${third._id}`, { token: first.token, body: {} });
  await api('PUT', `/api/v1/friends/acceptRequest/${requestId}`, {
    token: first.token,
    body: {},
    expected: 400,
  });
  await api('PUT', `/api/v1/friends/acceptRequest/${requestId}`, { token: third.token, body: {} });
  await api('PUT', `/api/v1/friends/remove/${requestId}`, {
    token: outsider.token,
    body: {},
    expected: 400,
  });
  await api('PUT', `/api/v1/friends/remove/${requestId}`, { token: first.token, body: {} });
  profile = (await api('GET', `/api/v1/users/getProfile/${third.username}`, { token: first.token }))
    .data;
  assert(!profile.friendship.friends && !profile.friendship.following);
  await api('PUT', `/api/v1/friends/follow/${third._id}`, { token: first.token, body: {} });
  profile = (await api('GET', `/api/v1/users/getProfile/${third.username}`, { token: first.token }))
    .data;
  assert(profile.friendship.following);
  await api('PUT', `/api/v1/friends/unfollow/${third._id}`, { token: first.token, body: {} });
  profile = (await api('GET', `/api/v1/users/getProfile/${third.username}`, { token: first.token }))
    .data;
  assert(!profile.friendship.following);
  console.log(
    'PASS friend request cancel/resend/accept/remove, permission checks and follow/unfollow'
  );
}
async function passwordResetRegression(user) {
  await api('POST', '/api/v1/users/signup', {
    body: {
      first_name: 'Test',
      last_name: 'Student',
      email: user.email,
      password: 'PtitDemo@2026',
      passwordConfirm: 'PtitDemo@2026',
      gender: 'male',
      birth_Year: 2003,
      birth_Month: 1,
      birth_Day: 15,
    },
    expected: 400,
  });
  await api('POST', '/api/v1/users/forgotPassword', { body: { email: user.email } });
  const inbox = await (await fetch('http://localhost:8025/api/v1/messages?limit=100')).json();
  const mail = inbox.messages.find((m) => m.To.some((to) => to.Address === user.email));
  mailIds.push(mail.ID);
  const detail = await (await fetch('http://localhost:8025/api/v1/message/' + mail.ID)).json();
  const code = detail.Text.match(/\b\d{6}\b/)[0];
  const wrongCode = code === '000000' ? '111111' : '000000';
  await api('POST', '/api/v1/users/resetPassword', {
    body: { email: user.email, code: wrongCode },
    expected: 401,
  });
  const reset = await api('POST', '/api/v1/users/resetPassword', {
    body: { email: user.email, code },
  });
  const body = {
    email: user.email,
    token: reset.data.token,
    password: 'Changed?123',
    passwordConfirm: 'Changed?123',
  };
  await api('PATCH', '/api/v1/users/resetPassword', {
    body: { ...body, passwordConfirm: 'Different!123' },
    expected: 400,
  });
  await api('PATCH', '/api/v1/users/resetPassword', {
    body: { ...body, password: 'Aa1!bc', passwordConfirm: 'Aa1!bc' },
    expected: 400,
  });
  const changed = await api('PATCH', '/api/v1/users/resetPassword', { body });
  assert.equal(changed.data.user._id, user._id);
  await api('POST', '/api/v1/users/login', {
    body: { email: user.email, password: 'PtitDemo@2026' },
    expected: 401,
  });
  await api('POST', '/api/v1/users/login', {
    body: { email: user.email, password: body.password },
  });
  await api('PATCH', '/api/v1/users/resetPassword', { body, expected: 400 });
  await api('POST', '/api/v1/users/resetPassword', {
    body: { email: user.email, code },
    expected: 401,
  });
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  try {
    await client
      .db('ptitsocial_accounts')
      .collection('users')
      .updateOne(
        { _id: new ObjectId(user._id) },
        {
          $set: {
            passwordResetToken: require('node:crypto')
              .createHash('sha256')
              .update('123456')
              .digest('hex'),
            passwordResetExpires: new Date(Date.now() - 1000),
          },
        }
      );
  } finally {
    await client.close();
  }
  await api('POST', '/api/v1/users/resetPassword', {
    body: { email: user.email, code: '123456' },
    expected: 401,
  });
  console.log(
    'PASS duplicate email; password recovery rejects wrong/expired/reused codes, enforces passwords and allows login'
  );
}
async function cleanup() {
  sockets.forEach((socket) => socket.close());
  if (!ids.length) return;
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  try {
    const participants = { $or: [{ sender: { $in: ids } }, { recipient: { $in: ids } }] };
    const accounts = client.db('ptitsocial_accounts');
    await accounts.collection('users').deleteMany({ _id: { $in: ids } });
    for (const name of ['friends', 'follows'])
      await accounts.collection(name).deleteMany(participants);
    const content = client.db('ptitsocial_content');
    for (const name of ['posts', 'comments', 'reactions'])
      await content.collection(name).deleteMany({ user: { $in: ids } });
    await content.collection('user_projections').deleteMany({ _id: { $in: ids } });
    await content.collection('follow_projections').deleteMany(participants);
    const messaging = client.db('ptitsocial_messaging');
    await messaging.collection('chats').deleteMany({ users: { $in: ids } });
    await messaging.collection('messages').deleteMany({ sender: { $in: ids } });
    await messaging.collection('notifications').deleteMany(participants);
    await messaging.collection('user_projections').deleteMany({ _id: { $in: ids } });
  } finally {
    await client.close();
  }
  const uploadRoot = path.resolve(__dirname, '../services/content/uploads');
  for (const url of fixtureImages) {
    const relative = decodeURIComponent(new URL(url).pathname).replace(/^\/uploads\//, '');
    for (const id of ids) {
      const parts = relative.split('/');
      const index = parts.indexOf(String(id));
      if (index < 1 || parts[index - 1] !== 'users') continue;
      const directory = path.resolve(uploadRoot, ...parts.slice(0, index + 1));
      assert(directory.startsWith(uploadRoot + path.sep));
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
  if (mailIds.length) {
    const response = await fetch('http://localhost:8025/api/v1/messages', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ IDs: mailIds }),
    });
    assert(response.ok, 'Fixture mail cleanup failed');
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(cleanup);
