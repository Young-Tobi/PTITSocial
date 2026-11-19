const assert = require('node:assert/strict');
const { MongoClient, ObjectId } = require('mongodb');
const { io } = require('socket.io-client');

const base = 'http://127.0.0.1:8000';
const password = 'StudyFlux@12345';
const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const emails = [`study-a-${stamp}@example.test`, `study-b-${stamp}@example.test`];
const created = {};
let accountsDb;
let studyDb;
let accountClient;
let studyClient;
let socketA;
let socketB;

async function request(pathname, { method = 'GET', token, body, includeHeaders = false } = {}) {
  const response = await fetch(base + pathname, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { cookie: token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`${method} ${pathname}: ${response.status} ${result?.message}`);
  return includeHeaders ? { result, headers: response.headers } : result;
}

async function signup(email, firstName) {
  await request('/api/v1/users/signup', {
    method: 'POST',
    body: {
      first_name: firstName,
      last_name: 'Integration',
      email,
      password,
      passwordConfirm: password,
      gender: 'male',
      birth_Year: 2002,
      birth_Month: 1,
      birth_Day: 1,
    },
  });
  await accountsDb.collection('users').updateOne({ email }, { $set: { verified: true } });
  const login = await request('/api/v1/users/login', {
    method: 'POST',
    body: { email, password },
    includeHeaders: true,
  });
  return {
    ...login.result.data,
    token: login.headers.get('set-cookie').split(';')[0],
  };
}

function emit(socket, event, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Socket ack timeout: ${event}`)), 5000);
    socket.emit(event, payload, (result) => {
      clearTimeout(timer);
      result?.ok ? resolve(result.data) : reject(new Error(result?.message || `${event} failed`));
    });
  });
}

function once(socket, event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Socket event timeout: ${event}`)), 5000);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(base, {
      path: '/study-socket.io',
      transports: ['websocket'],
      extraHeaders: { cookie: token },
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket connection timeout'));
    }, 5000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function cleanup() {
  socketA?.disconnect();
  socketB?.disconnect();
  if (studyDb) {
    if (created.roomId) {
      const room = new ObjectId(created.roomId);
      await Promise.all([
        studyDb.collection('focusroommessages').deleteMany({ room }),
        studyDb.collection('focusroomparticipants').deleteMany({ room }),
        studyDb.collection('focusrooms').deleteOne({ _id: room }),
      ]);
    }
    if (created.meetupId) {
      const meetup = new ObjectId(created.meetupId);
      await studyDb.collection('studymeetupregistrations').deleteMany({ meetup });
      await studyDb.collection('studymeetups').deleteOne({ _id: meetup });
    }
    if (created.userIds) {
      const ids = created.userIds.map((id) => new ObjectId(id));
      await studyDb.collection('studylocationreviews').deleteMany({ user: { $in: ids } });
      await studyDb.collection('user_projections').deleteMany({ _id: { $in: ids } });
    }
  }
  if (accountsDb) await accountsDb.collection('users').deleteMany({ email: { $in: emails } });
  await Promise.allSettled([accountClient?.close(), studyClient?.close()]);
}

async function main() {
  accountClient = new MongoClient('mongodb://127.0.0.1:27017');
  studyClient = new MongoClient('mongodb://127.0.0.1:27017');
  await Promise.all([accountClient.connect(), studyClient.connect()]);
  accountsDb = accountClient.db('ptitsocial_accounts');
  studyDb = studyClient.db('ptitsocial_study');

  const [a, b] = await Promise.all([signup(emails[0], 'StudyA'), signup(emails[1], 'StudyB')]);
  created.userIds = [a.user._id, b.user._id];

  const roomResult = await request('/api/v1/study/focus-rooms', {
    method: 'POST',
    token: a.token,
    body: {
      name: `Integration Focus ${stamp}`,
      topic: 'Web',
      maxMembers: 2,
      privacy: 'private',
      password: 'TestRoom@123',
    },
  });
  created.roomId = roomResult.data.room._id;
  assert.equal(roomResult.data.room.accessPasswordHash, undefined);
  await assert.rejects(
    request(`/api/v1/study/focus-rooms/${created.roomId}/join`, {
      method: 'POST',
      token: b.token,
      body: { inviteCode: roomResult.data.room.inviteCode, password: 'wrong-password' },
    }),
    /403 Incorrect room password/
  );
  await request(`/api/v1/study/focus-rooms/${created.roomId}/join`, {
    method: 'POST',
    token: b.token,
    body: { inviteCode: roomResult.data.room.inviteCode, password: 'TestRoom@123' },
  });
  const roomA = await request(`/api/v1/study/focus-rooms/${created.roomId}`, { token: a.token });
  const roomB = await request(`/api/v1/study/focus-rooms/${created.roomId}`, { token: b.token });
  assert.equal(roomA.data.participants.length, 2);
  assert.equal(roomB.data.participants.length, 2);

  const liveKit = await request(`/api/v1/study/focus-rooms/${created.roomId}/livekit-token`, {
    method: 'POST',
    token: a.token,
    body: {},
  });
  assert.equal(liveKit.data.url, 'ws://localhost:7880');
  assert.ok(liveKit.data.token.split('.').length === 3);

  [socketA, socketB] = await Promise.all([connect(a.token), connect(b.token)]);
  await Promise.all([
    emit(socketA, 'focus_join', { roomId: created.roomId }),
    emit(socketB, 'focus_join', { roomId: created.roomId }),
  ]);
  const chatEvent = once(socketB, 'focus_message');
  await emit(socketA, 'focus_message', { roomId: created.roomId, text: 'integration hello' });
  assert.equal((await chatEvent).text, 'integration hello');
  const timerEvent = once(socketB, 'pomodoro_state');
  await emit(socketA, 'pomodoro_control', {
    roomId: created.roomId,
    action: 'start',
    focusMinutes: 25,
    breakMinutes: 5,
  });
  assert.equal((await timerEvent).status, 'running');
  const micEvent = once(socketB, 'focus_mic');
  await emit(socketA, 'focus_mic', { roomId: created.roomId, enabled: true });
  assert.equal((await micEvent).enabled, true);
  const policyLocked = once(socketB, 'focus_mic_policy');
  const forcedMute = once(socketB, 'focus_force_mute');
  await emit(socketA, 'focus_mic_policy', { roomId: created.roomId, enabled: false });
  assert.equal((await policyLocked).enabled, false);
  assert.equal((await forcedMute).roomId, created.roomId);
  await assert.rejects(
    emit(socketB, 'focus_mic', { roomId: created.roomId, enabled: true }),
    /disabled microphones/
  );
  await emit(socketA, 'focus_mic_policy', { roomId: created.roomId, enabled: true });
  await emit(socketB, 'focus_mic', { roomId: created.roomId, enabled: true });
  const participantMuted = once(socketB, 'focus_force_mute');
  await emit(socketA, 'focus_mute_participant', { roomId: created.roomId, userId: b.user._id });
  assert.equal((await participantMuted).roomId, created.roomId);

  const locations = await request('/api/v1/study/locations', { token: a.token });
  assert.ok(locations.data.locations.length >= 4);
  const locationId = locations.data.locations[0]._id;
  const [longitude, latitude] = locations.data.locations[0].coordinates.coordinates;
  const nearby = await request(
    `/api/v1/study/locations/nearby?lat=${latitude + 0.001}&lng=${longitude + 0.001}&suitableFor=group&radiusKm=10`,
    { token: a.token }
  );
  assert.ok(nearby.data.locations.length >= 1);
  assert.ok(nearby.data.locations.every((item) => item.distanceMeters > 0));
  assert.deepEqual(
    nearby.data.locations.map((item) => item.distanceMeters),
    nearby.data.locations.map((item) => item.distanceMeters).sort((a, b) => a - b)
  );
  await request(`/api/v1/study/locations/${locationId}/review`, {
    method: 'PUT',
    token: b.token,
    body: { rating: 5, comment: 'Integration review' },
  });
  const startsAt = new Date(Date.now() + 86400000);
  const meetupResult = await request('/api/v1/study/meetups', {
    method: 'POST',
    token: a.token,
    body: {
      title: `Integration Meetup ${stamp}`,
      subject: 'Web',
      goal: 'Test',
      location: locationId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3600000),
      maxParticipants: 2,
    },
  });
  created.meetupId = meetupResult.data.meetup._id;
  await request(`/api/v1/study/meetups/${created.meetupId}/request`, {
    method: 'POST',
    token: b.token,
    body: {},
  });
  const mineA = await request('/api/v1/study/meetups/mine', { token: a.token });
  const registration = mineA.data.requests.find((item) => String(item.meetup) === created.meetupId);
  assert.ok(registration);
  await request(`/api/v1/study/registrations/${registration._id}/decision`, {
    method: 'PATCH',
    token: a.token,
    body: { status: 'accepted' },
  });
  const mineB = await request('/api/v1/study/meetups/mine', { token: b.token });
  assert.equal(
    mineB.data.registrations.find((item) => String(item.meetup?._id) === created.meetupId)?.status,
    'accepted'
  );
  console.log(
    'Study integration passed: two accounts, room realtime, LiveKit token, nearby suggestions, review and Meetup approval.'
  );
}

main()
  .then(cleanup)
  .catch(async (error) => {
    console.error(error);
    await cleanup();
    process.exit(1);
  });
