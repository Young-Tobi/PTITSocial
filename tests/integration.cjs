const assert = require('node:assert/strict');
const { MongoClient, ObjectId } = require('mongodb');
const sharp = require('sharp');
const { io } = require('../apps/web/node_modules/socket.io-client');
const base = 'http://localhost:8000';
const tag = Date.now();
const ids = [];
const sockets = [];
const fixtureImages = [];
async function api(method, pathname, { token, body, form, expected, includeHeaders = false } = {}) {
  const response = await fetch(base + pathname, {
    method,
    headers: {
      ...(token ? { cookie: token } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: form || (body ? JSON.stringify(body) : undefined),
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json();
  if (expected) assert.equal(response.status, expected, JSON.stringify(data));
  else assert(response.ok, `${method} ${pathname}: ${response.status} ${JSON.stringify(data)}`);
  return includeHeaders ? { data, headers: response.headers } : data;
}
async function account(index) {
  const email = `architecture-${tag}-${index}@example.com`.toLowerCase();
  const response = await api('POST', '/api/v1/users/signup', {
    includeHeaders: true,
    body: {
      first_name: 'Integration',
      last_name: 'Student' + index,
      email,
      password: 'Backbook@123',
      passwordConfirm: 'Backbook@123',
      gender: 'male',
      birth_Year: 2003,
      birth_Month: 1,
      birth_Day: 15,
    },
  });
  const user = {
    ...response.data.data.user,
    token: response.headers.get('set-cookie').split(';')[0],
    email,
  };
  ids.push(new ObjectId(user._id));
  return user;
}
async function activate(user) {
  const inbox = await (await fetch('http://localhost:8025/api/v1/messages?limit=100')).json();
  const email = inbox.messages.find((message) =>
    message.To.some((to) => to.Address === user.email)
  );
  assert(email, 'Verification email must arrive');
  const detail = await (await fetch('http://localhost:8025/api/v1/message/' + email.ID)).json();
  const verificationToken = (detail.Text || detail.HTML).match(/\/activate\/([a-f0-9]+)/)[1];
  await api('POST', '/api/v1/users/emailVerification', {
    token: user.token,
    body: { token: verificationToken },
  });
}
async function connect(user) {
  const socket = io(base, {
    extraHeaders: { cookie: user.token },
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
  assert.deepEqual(health.services, { accounts: 'ok', content: 'ok', messaging: 'ok' });
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
    const messaging = client.db('ptitsocial_messaging');
    await messaging.collection('chats').deleteMany({ users: { $in: ids } });
    await messaging.collection('messages').deleteMany({ sender: { $in: ids } });
    await messaging.collection('notifications').deleteMany(participants);
    await messaging.collection('user_projections').deleteMany({ _id: { $in: ids } });
  } finally {
    await client.close();
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(cleanup);
