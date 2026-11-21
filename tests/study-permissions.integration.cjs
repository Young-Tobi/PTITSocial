const assert = require('node:assert/strict');
require('dotenv').config();
const path = require('node:path');
const { MongoClient, ObjectId } = require('mongodb');
const { chromium } = require('playwright');
const { io } = require('socket.io-client');
const { RoomServiceClient } = require('livekit-server-sdk');
const { run } = require('./academic/integration.cjs');

const apiBase = process.env.TEST_API_URL || 'http://localhost:8000';
const site = process.env.TEST_WEB_URL || 'http://localhost:3000';
const audio = new RoomServiceClient(
  (process.env.LIVEKIT_URL || 'ws://localhost:7880').replace(/^ws/, 'http'),
  process.env.LIVEKIT_API_KEY || 'devkey',
  process.env.LIVEKIT_API_SECRET || 'secret'
);
const claims = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function emit(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket
      .timeout(5000)
      .emit(event, payload, (error, result) => (error ? reject(error) : resolve(result)));
  });
}

async function connect(user) {
  const socket = io(apiBase, {
    path: '/study-socket.io',
    transports: ['websocket'],
    auth: { token: user.token },
  });
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}

run(async ({ a, b, c, api, tag }) => {
  const roomIds = [],
    audioRooms = new Set(),
    sockets = [];
  const client = await MongoClient.connect(
    process.env.TEST_MONGO_URL || 'mongodb://127.0.0.1:27017'
  );
  const db = client.db('ptitsocial_study');
  const browser = await chromium.launch({
    channel: process.env.TEST_BROWSER_CHANNEL || 'chrome',
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const contextA = await browser.newContext({ permissions: ['microphone'] });
  const contextB = await browser.newContext({ permissions: ['microphone'] });
  const pageA = await contextA.newPage(),
    pageB = await contextB.newPage();
  const pageC = await (await browser.newContext({ permissions: ['microphone'] })).newPage();
  for (const page of [pageA, pageB, pageC]) page.setDefaultTimeout(25000);

  async function login(page, user) {
    await page.goto(site);
    await page.locator('input[name=email]').fill(user.email);
    await page.locator('input[name=password]').fill('Backbook@123');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.getByRole('navigation', { name: 'Main navigation' }).waitFor();
  }
  async function token(user, roomId) {
    const data = (await api('POST', `/study/focus-rooms/${roomId}/livekit-token`, user, {})).data;
    audioRooms.add(claims(data.token).video.room);
    return data;
  }
  async function voiceReady(page) {
    await page.getByText('Đã kết nối âm thanh phòng', { exact: true }).waitFor();
  }
  try {
    await login(pageA, a);
    await login(pageB, b);
    const locations = (await api('GET', '/study/locations', a)).data.locations;
    assert(locations.length, 'Seed study locations before running this test');
    for (const query of [
      'lat=&lng=',
      'lat=%20&lng=105',
      'lat=21',
      'lng=105',
      'lat=91&lng=105',
      'lat=21&lng=181',
      'lat=NaN&lng=105',
    ])
      await api('GET', '/study/locations/nearby?' + query, a, undefined, 400);
    await api('GET', '/study/locations/nearby?lat=0&lng=0', a);
    console.log(
      'PASS SS-05: empty/missing/malformed coordinates rejected; numeric zero remains valid'
    );

    const locationId = locations[0]._id;
    await pageA.goto(site + '/study-spots/' + locationId);
    const comment = 'Review deletion regression ' + tag;
    await pageA.getByPlaceholder('Chia sẻ trải nghiệm của bạn…').fill(comment);
    await pageA.getByRole('button', { name: 'Lưu đánh giá', exact: true }).click();
    const review = pageA
      .locator('article')
      .filter({ has: pageA.getByText(comment, { exact: true }) });
    await review.getByRole('button', { name: 'Xóa đánh giá', exact: true }).waitFor();
    await pageB.goto(site + '/study-spots/' + locationId);
    const otherReview = pageB
      .locator('article')
      .filter({ has: pageB.getByText(comment, { exact: true }) });
    await otherReview.waitFor();
    assert.equal(await otherReview.getByRole('button', { name: 'Xóa đánh giá' }).count(), 0);
    pageA.once('dialog', (dialog) => dialog.dismiss());
    await review.getByRole('button', { name: 'Xóa đánh giá', exact: true }).click();
    await review.waitFor();
    pageA.once('dialog', (dialog) => dialog.accept());
    await review.getByRole('button', { name: 'Xóa đánh giá', exact: true }).click();
    await review.waitFor({ state: 'detached' });
    await pageA.reload();
    await pageA.getByRole('heading', { name: locations[0].name, exact: true }).waitFor();
    assert.equal(await pageA.getByText(comment, { exact: true }).count(), 0);
    console.log(
      'PASS SS-16: own review delete, cancel/confirm, persistence, hidden for other users'
    );

    const room = (
      await api(
        'POST',
        '/study/focus-rooms',
        a,
        {
          name: 'Permissions regression ' + tag,
          privacy: 'private',
          password: 'Room@123',
          maxMembers: 3,
        },
        201
      )
    ).data.room;
    roomIds.push(new ObjectId(room._id));
    const invitation = { inviteCode: room.inviteCode, password: 'Room@123' };
    for (const user of [b, c])
      await api('POST', `/study/focus-rooms/${room._id}/join`, user, invitation);
    const oldVoice = await token(c, room._id);
    await pageC.goto(site);
    await pageC.addScriptTag({
      path: path.resolve('apps/web/node_modules/livekit-client/dist/livekit-client.umd.js'),
    });
    await pageC.evaluate(async (voice) => {
      window.probe = new LivekitClient.Room();
      await window.probe.connect(voice.url, voice.token);
      await window.probe.localParticipant.setMicrophoneEnabled(true);
    }, oldVoice);
    for (const page of [pageA, pageB]) await page.goto(site + '/focus/' + room._id);
    await Promise.all([voiceReady(pageA), voiceReady(pageB)]);
    const memberB = pageA.locator(`[data-user-id="${b._id}"]`);
    const secondTab = await connect(b);
    sockets.push(secondTab);
    assert((await emit(secondTab, 'focus_join', { roomId: room._id })).ok);
    await pageB.goto('about:blank');
    await delay(250);
    assert.equal(await memberB.getByText('Ngoại tuyến', { exact: true }).count(), 0);
    secondTab.disconnect();
    await memberB.getByText('Ngoại tuyến', { exact: true }).waitFor();
    const disconnected = (await api('GET', `/study/focus-rooms/${room._id}`, a)).data;
    assert.equal(disconnected.participants.find((p) => p.user._id === b._id).online, false);
    await pageB.goto(site + '/focus/' + room._id);
    await memberB.getByText('Đang học', { exact: true }).waitFor();
    await voiceReady(pageB);
    console.log('PASS FR-15: last-tab disconnect becomes offline, reconnect restores presence');
    await pageA.getByRole('button', { name: 'Khóa mic toàn phòng', exact: true }).click();
    await pageB.getByRole('button', { name: 'Chủ phòng đã khóa mic', exact: true }).waitFor();
    await pageC.waitForFunction(() => window.probe.state === 'disconnected');
    await Promise.all([voiceReady(pageA), voiceReady(pageB)]);
    const lockedVoice = await token(c, room._id);
    assert.equal(claims(lockedVoice.token).video.canPublish, false);
    assert.notEqual(claims(lockedVoice.token).video.room, claims(oldVoice.token).video.room);
    const lockedMembers = await audio.listParticipants(claims(lockedVoice.token).video.room);
    assert(lockedMembers.length >= 2);
    assert(lockedMembers.every((member) => !member.permission.canPublish));
    // A cached token can only recreate the retired room, never the active room.
    await pageC.evaluate(async (voice) => {
      window.probe = new LivekitClient.Room();
      await window.probe.connect(voice.url, voice.token);
    }, oldVoice);
    assert.equal((await audio.listParticipants(claims(oldVoice.token).video.room)).length, 1);
    console.log(
      'PASS FR-11: old audio disconnected, cached token isolated, current room publish denied, UI reconnected'
    );

    await pageA.getByRole('button', { name: 'Cho phép bật mic', exact: true }).click();
    await Promise.all([voiceReady(pageA), voiceReady(pageB)]);
    for (const page of [pageA, pageB]) {
      await page.getByRole('button', { name: 'Bật micro', exact: true }).click();
      await page.getByRole('button', { name: 'Đang bật mic', exact: true }).waitFor();
    }
    for (const page of [pageA, pageB])
      await page.waitForFunction(() =>
        [...document.querySelectorAll('audio')].some((el) =>
          el.srcObject?.getAudioTracks().some((track) => track.readyState === 'live')
        )
      );
    console.log('PASS FR-10 regression: unlock restores audio tracks both ways');

    const hostSocket = await connect(a),
      kickedSocket = await connect(b);
    sockets.push(hostSocket, kickedSocket);
    for (const socket of [hostSocket, kickedSocket])
      assert((await emit(socket, 'focus_join', { roomId: room._id })).ok);
    const beforeKick = await token(a, room._id);
    assert((await emit(hostSocket, 'focus_kick', { roomId: room._id, userId: b._id })).ok);
    await pageB.waitForURL(site + '/focus');
    await voiceReady(pageA);
    const afterKick = await token(a, room._id);
    assert.notEqual(claims(afterKick.token).video.room, claims(beforeKick.token).video.room);
    let received = false;
    kickedSocket.on('focus_message', () => {
      received = true;
    });
    assert(
      (await emit(hostSocket, 'focus_message', { roomId: room._id, text: 'After kick ' + tag })).ok
    );
    await delay(300);
    assert.equal(received, false);
    assert.equal((await emit(kickedSocket, 'focus_join', { roomId: room._id })).ok, false);
    assert.equal(
      (await emit(kickedSocket, 'focus_message', { roomId: room._id, text: 'Denied' })).ok,
      false
    );
    await api('POST', `/study/focus-rooms/${room._id}/join`, b, invitation, 403);
    await api('POST', `/study/focus-rooms/${room._id}/livekit-token`, b, {}, 403);
    const current = await audio.listParticipants(claims(afterKick.token).video.room);
    assert(!current.some((member) => member.identity === b._id));
    console.log(
      'PASS FR-14: kick removes socket/audio access, blocks invitation reuse, other members reconnect'
    );

    // A voluntary departure remains different from a kick.
    const leave = await fetch(`${apiBase}/api/v1/study/focus-rooms/${room._id}/leave`, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + c.token },
    });
    assert.equal(leave.status, 204);
    await api('POST', `/study/focus-rooms/${room._id}/join`, c, invitation);
    assert((await emit(hostSocket, 'focus_end', { roomId: room._id })).ok);
    await api('POST', `/study/focus-rooms/${room._id}/livekit-token`, a, {}, 403);
    console.log('PASS room lifecycle: voluntary rejoin allowed; ended room access revoked');
  } finally {
    for (const socket of sockets) socket.disconnect();
    await browser.close();
    for (const name of audioRooms) await audio.deleteRoom(name).catch(() => {});
    for (const collection of ['focusroommessages', 'focusroomparticipants'])
      await db.collection(collection).deleteMany({ room: { $in: roomIds } });
    await db.collection('focusrooms').deleteMany({ _id: { $in: roomIds } });
    const ids = [a, b, c].map((user) => new ObjectId(user._id));
    await db.collection('user_projections').deleteMany({ _id: { $in: ids } });
    await db.collection('studylocationreviews').deleteMany({ user: { $in: ids } });
    await client.close();
  }
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
