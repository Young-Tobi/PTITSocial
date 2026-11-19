import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { AudioPresets, ConnectionState, Room, RoomEvent, Track } from 'livekit-client';
import {
  FiClock,
  FiCopy,
  FiHeadphones,
  FiLock,
  FiLogOut,
  FiMic,
  FiMicOff,
  FiPause,
  FiPlay,
  FiSend,
  FiSquare,
  FiUsers,
  FiVolume2,
  FiVolumeX,
  FiX,
} from 'react-icons/fi';
import { studyApi, errorMessage } from 'features/study/api';
import useAmbientSound from 'features/study/useAmbientSound';
import styles from './focus.module.css';

const themeNames = {
  'night-library': 'Thư viện ban đêm',
  'coffee-shop': 'Quán cà phê',
  'rain-window': 'Mưa bên cửa sổ',
  'green-nature': 'Không gian thiên nhiên',
};
const themeVideos = {
  'night-library': {
    youtubeId: 'HA96VDEPxIs',
    start: 20,
    label: 'THƯ VIỆN · VIDEO REAL-TIME 01:00:00',
  },
  'coffee-shop': {
    youtubeId: 'KVmxdVv__tc',
    start: 25,
    label: 'STUDY CAFÉ · VIDEO REAL-TIME 01:00:00',
  },
  'rain-window': {
    src: '/study-media/rain-window-5min.mp4',
    label: 'MƯA BÊN CỬA SỔ · 05:00',
  },
  'green-nature': {
    youtubeId: '1ajdEuUUxEc',
    start: 30,
    label: 'THIÊN NHIÊN · VIDEO REAL-TIME 01:00:00',
  },
};
const makeFocusCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(
    { length: 6 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)]
  ).join('');
};
const userId = (participant) =>
  String(participant?.user?._id || participant?.user?.id || participant?.user || '');
function secondsLeft(pomodoro) {
  if (pomodoro?.status === 'running' && pomodoro.endsAt)
    return Math.max(0, Math.ceil((new Date(pomodoro.endsAt) - Date.now()) / 1000));
  return pomodoro?.remainingSeconds || 0;
}
function displayTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function FocusRoom() {
  const { roomId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const me = useSelector((state) => state.user.userinfo);
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [pomodoro, setPomodoro] = useState(null);
  const [durations, setDurations] = useState({ focusMinutes: 25, breakMinutes: 5 });
  const [remaining, setRemaining] = useState(0);
  const [isHost, setIsHost] = useState(false);
  const [theme, setTheme] = useState('night-library');
  const [text, setText] = useState('');
  const [micOn, setMicOn] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);
  const [micStatus, setMicStatus] = useState('');
  const [audioConnected, setAudioConnected] = useState(false);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [audioSessionVersion, setAudioSessionVersion] = useState(0);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [joinPassword, setJoinPassword] = useState('');
  const [socket, setSocket] = useState(null);
  const [focusChallenge, setFocusChallenge] = useState(null);
  const [challengeInput, setChallengeInput] = useState('');
  const liveRoom = useRef(null);
  const audioConnecting = useRef(null);
  const backgroundVideo = useRef(null);
  const audioMount = useRef(null);
  const chatBottom = useRef(null);
  const ambient = useAmbientSound();

  const applyRoomData = useCallback((data) => {
    setRoom(data.room);
    setTheme(data.room.theme);
    setParticipants(data.participants);
    setMessages(data.messages);
    setPomodoro(data.room.pomodoro);
    setDurations({
      focusMinutes: data.room.pomodoro.focusMinutes,
      breakMinutes: data.room.pomodoro.breakMinutes,
    });
    setIsHost(data.isHost);
    setNeedsPassword(false);
  }, []);

  const forceMuteMicrophone = useCallback(async (message) => {
    const voiceRoom = liveRoom.current;
    if (voiceRoom?.state === ConnectionState.Connected) {
      await voiceRoom.localParticipant.setMicrophoneEnabled(false).catch(() => {});
    }
    setMicOn(false);
    setMicStatus(message);
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadRoom() {
      try {
        let response;
        try {
          response = await studyApi.get(`/focus-rooms/${roomId}`);
        } catch (error) {
          if (error?.response?.status !== 403) throw error;
          const inviteCode = search.get('invite') || undefined;
          if (inviteCode) {
            if (alive) setNeedsPassword(true);
            return;
          }
          await studyApi.post(`/focus-rooms/${roomId}/join`, {
            inviteCode,
          });
          response = await studyApi.get(`/focus-rooms/${roomId}`);
        }
        if (!alive) return;
        applyRoomData(response.data.data);
      } catch (error) {
        toast.error(errorMessage(error));
        navigate('/focus');
      }
    }
    loadRoom();
    return () => {
      alive = false;
    };
  }, [roomId, navigate, search, applyRoomData]);

  const joinPrivateRoom = async (event) => {
    event.preventDefault();
    try {
      await studyApi.post(`/focus-rooms/${roomId}/join`, {
        inviteCode: search.get('invite') || undefined,
        password: joinPassword,
      });
      const response = await studyApi.get(`/focus-rooms/${roomId}`);
      applyRoomData(response.data.data);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  useEffect(() => {
    if (!room) return undefined;
    const studySocket = io(process.env.REACT_APP_BACKEND_URL, {
      path: '/study-socket.io',
      withCredentials: true,
    });
    setSocket(studySocket);
    studySocket.emit('focus_join', { roomId });
    studySocket.on('focus_message', (message) =>
      setMessages((old) => [...old, message].slice(-100))
    );
    studySocket.on('focus_mic', ({ userId: id, enabled }) =>
      setParticipants((old) =>
        old.map((p) => (userId(p) === String(id) ? { ...p, micEnabled: enabled } : p))
      )
    );
    studySocket.on('focus_mic_policy', ({ enabled }) => {
      setRoom((current) => (current ? { ...current, allowMicrophones: enabled } : current));
      if (!enabled) forceMuteMicrophone('Chủ phòng đã khóa micro của phòng.');
      liveRoom.current?.disconnect();
      liveRoom.current = null;
      setAudioConnected(false);
      setAudioSessionVersion((version) => version + 1);
    });
    studySocket.on('focus_force_mute', ({ roomId: targetRoomId }) => {
      if (String(targetRoomId) === String(roomId))
        forceMuteMicrophone('Micro của bạn đã được chủ phòng tắt.');
    });
    studySocket.on('focus_presence', ({ type, user }) => {
      if (type === 'online')
        setParticipants((old) =>
          old.some((p) => userId(p) === String(user.id))
            ? old
            : [...old, { user, active: true, micEnabled: false }]
        );
    });
    studySocket.on('participant_left', ({ userId: id }) =>
      setParticipants((old) => old.filter((p) => userId(p) !== String(id)))
    );
    studySocket.on('focus_kicked', ({ userId: id }) => {
      setParticipants((old) => old.filter((p) => userId(p) !== String(id)));
      if (String(id) === String(me?._id)) {
        toast.error('Bạn đã được mời rời phòng');
        navigate('/focus');
      }
    });
    const updatePomodoro = (state) => {
      setPomodoro(state);
      if (state.status === 'running')
        toast(state.mode === 'focus' ? 'Bắt đầu phiên tập trung' : 'Đến giờ nghỉ');
    };
    studySocket.on('pomodoro_state', updatePomodoro);
    studySocket.on('pomodoro_phase', updatePomodoro);
    studySocket.on('focus_ended', () => {
      toast('Phiên học đã kết thúc');
      navigate('/focus');
    });
    return () => {
      studySocket.disconnect();
      setSocket(null);
    };
  }, [room, roomId, me?._id, navigate, forceMuteMicrophone]);

  useEffect(() => {
    setRemaining(secondsLeft(pomodoro));
    const timer = setInterval(() => setRemaining(secondsLeft(pomodoro)), 1000);
    return () => clearInterval(timer);
  }, [pomodoro]);
  useEffect(() => {
    chatBottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  useEffect(
    () => () => {
      liveRoom.current?.disconnect();
    },
    []
  );

  useEffect(() => {
    if (!room || !backgroundVideo.current) return;
    backgroundVideo.current.muted = true;
    backgroundVideo.current.play().catch(() => {
      toast.error('Trình duyệt đang chặn video tự phát. Hãy bấm vào trang để phát nền.');
    });
  }, [room, theme]);

  useEffect(() => {
    if (!room || pomodoro?.status !== 'running') return undefined;
    const confirmBrowserExit = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', confirmBrowserExit);
    return () => window.removeEventListener('beforeunload', confirmBrowserExit);
  }, [room, pomodoro?.status]);

  const audioConnect = useCallback(async () => {
    if (liveRoom.current?.state === ConnectionState.Connected) return liveRoom.current;
    if (audioConnecting.current) return audioConnecting.current;
    audioConnecting.current = (async () => {
      const { data } = await studyApi.post(`/focus-rooms/${roomId}/livekit-token`);
      const voiceRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: { ideal: true },
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          voiceIsolation: { ideal: true },
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
          latency: { ideal: 0.02 },
        },
        publishDefaults: {
          audioPreset: AudioPresets.speech,
          dtx: true,
          red: true,
          forceStereo: false,
          stopMicTrackOnMute: false,
        },
      });
      voiceRoom.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const element = track.attach();
          element.autoplay = true;
          audioMount.current?.appendChild(element);
        }
      });
      voiceRoom.on(RoomEvent.TrackUnsubscribed, (track) =>
        track.detach().forEach((node) => node.remove())
      );
      voiceRoom.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        setAudioPlaybackBlocked(!voiceRoom.canPlaybackAudio);
      });
      voiceRoom.on(RoomEvent.Reconnecting, () => {
        setAudioConnected(false);
        setMicStatus('Đường truyền âm thanh đang kết nối lại…');
      });
      voiceRoom.on(RoomEvent.Reconnected, () => {
        setAudioConnected(true);
        setMicStatus('Đường truyền âm thanh đã ổn định trở lại');
      });
      voiceRoom.on(RoomEvent.MediaDevicesError, (error) => {
        setMicStatus('Trình duyệt không truy cập được micro. Hãy cấp quyền micro rồi thử lại.');
        toast.error(error?.message || 'Không truy cập được micro');
      });
      await voiceRoom.connect(data.data.url, data.data.token);
      liveRoom.current = voiceRoom;
      setAudioConnected(true);
      try {
        await voiceRoom.startAudio();
        setAudioPlaybackBlocked(false);
      } catch {
        setAudioPlaybackBlocked(true);
      }
      return voiceRoom;
    })();
    try {
      return await audioConnecting.current;
    } finally {
      audioConnecting.current = null;
    }
  }, [roomId]);

  useEffect(() => {
    if (!room) return undefined;
    let active = true;
    audioConnect().catch((error) => {
      if (!active) return;
      setAudioConnected(false);
      const message = /signal connection|failed to fetch|websocket/i.test(
        String(error?.message || '')
      )
        ? 'Máy chủ âm thanh LiveKit chưa hoạt động.'
        : errorMessage(error);
      setMicStatus(message);
    });
    return () => {
      active = false;
    };
  }, [room, audioSessionVersion, audioConnect]);

  const enableRoomAudio = async () => {
    try {
      const voiceRoom = await audioConnect();
      await voiceRoom.startAudio();
      setAudioPlaybackBlocked(false);
      setMicStatus('Âm thanh phòng đang hoạt động');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const toggleMic = async () => {
    if (room?.allowMicrophones === false) {
      const message = 'Chủ phòng đang khóa micro. Bạn chưa thể bật mic trong phòng này.';
      setMicStatus(message);
      return toast.error(message);
    }
    setAudioBusy(true);
    setMicStatus('');
    try {
      const voiceRoom = micOn ? liveRoom.current : await audioConnect();
      await voiceRoom.localParticipant.setMicrophoneEnabled(!micOn);
      const enabled = voiceRoom.localParticipant.isMicrophoneEnabled;
      const microphoneTrack = voiceRoom.localParticipant.getTrackPublication(
        Track.Source.Microphone
      )?.track;
      if (microphoneTrack?.mediaStreamTrack)
        microphoneTrack.mediaStreamTrack.contentHint = 'speech';
      setMicOn(enabled);
      setMicStatus(enabled ? 'Micro đang hoạt động' : 'Micro đã tắt');
      socket?.emit('focus_mic', { roomId, enabled }, (result) => {
        if (!result?.ok && enabled) {
          forceMuteMicrophone('Chủ phòng đang khóa micro.');
          toast.error(result?.message);
        }
      });
    } catch (error) {
      const denied = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
      const liveKitUnavailable = /signal connection|failed to fetch|websocket/i.test(
        String(error?.message || '')
      );
      const message = denied
        ? 'Micro đang bị chặn. Bấm biểu tượng ổ khóa trên thanh địa chỉ và chọn Cho phép.'
        : liveKitUnavailable
          ? 'Máy chủ âm thanh LiveKit chưa hoạt động. Hãy bật Docker Desktop và khởi động lại môi trường đầy đủ.'
          : errorMessage(error);
      setMicStatus(message);
      toast.error(message);
    } finally {
      setAudioBusy(false);
    }
  };
  const send = (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    socket?.emit('focus_message', { roomId, text }, (result) => {
      if (!result?.ok) toast.error(result?.message);
    });
    setText('');
  };
  const controlPomodoro = (action) =>
    socket?.emit('pomodoro_control', { roomId, action, ...durations }, (result) => {
      if (!result?.ok) toast.error(result?.message);
    });
  const updateMicPolicy = (enabled) =>
    socket?.emit('focus_mic_policy', { roomId, enabled }, (result) => {
      if (!result?.ok) return toast.error(result?.message);
      toast.success(enabled ? 'Thành viên có thể tự bật micro' : 'Đã khóa micro toàn phòng');
    });
  const muteParticipant = (participantId) =>
    socket?.emit('focus_mute_participant', { roomId, userId: participantId }, (result) => {
      if (!result?.ok) toast.error(result?.message);
    });
  const requestFocusConfirmation = (title, description, action) => {
    setChallengeInput('');
    setFocusChallenge({ title, description, action, code: makeFocusCode() });
  };
  const confirmFocusAction = (event) => {
    event.preventDefault();
    if (challengeInput !== focusChallenge?.code) return;
    const action = focusChallenge.action;
    setFocusChallenge(null);
    setChallengeInput('');
    action();
  };
  const leaveNow = async () => {
    if (isHost) return socket?.emit('focus_end', { roomId });
    try {
      await studyApi.post(`/focus-rooms/${roomId}/leave`);
      navigate('/focus');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const leave = () =>
    requestFocusConfirmation(
      isHost ? 'Kết thúc phòng học?' : 'Rời phòng tập trung?',
      isHost
        ? 'Toàn bộ thành viên sẽ bị rời khỏi phòng và phiên học hiện tại sẽ kết thúc.'
        : 'Bạn đang ở trong một phiên tập trung. Hãy xác nhận chủ động trước khi rời đi.',
      leaveNow
    );
  const changeTheme = (nextTheme) => {
    if (nextTheme === theme) return;
    if (pomodoro?.status === 'running') {
      requestFocusConfirmation(
        'Đổi không gian khi đang tập trung?',
        'Đổi cảnh giữa phiên có thể làm gián đoạn nhịp học hiện tại.',
        () => setTheme(nextTheme)
      );
      return;
    }
    setTheme(nextTheme);
  };
  const shareUrl = useMemo(
    () =>
      room?.inviteCode
        ? `${window.location.origin}/focus/${roomId}?invite=${room.inviteCode}`
        : `${window.location.origin}/focus/${roomId}`,
    [room, roomId]
  );
  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast.success(
      room?.privacy === 'private'
        ? 'Đã sao chép link. Hãy gửi mật khẩu phòng qua kênh riêng.'
        : 'Đã sao chép liên kết phòng'
    );
  };

  if (needsPassword && !room)
    return (
      <main className={styles.privateJoinPage}>
        <form className={styles.privateJoinCard} onSubmit={joinPrivateRoom}>
          <FiLock />
          <span>PHÒNG HỌC RIÊNG TƯ</span>
          <h1>Nhập mật khẩu phòng</h1>
          <p>Link mời đã hợp lệ. Bạn cần thêm mật khẩu do chủ phòng cung cấp.</p>
          <input
            required
            autoFocus
            minLength="4"
            maxLength="64"
            type="password"
            value={joinPassword}
            onChange={(event) => setJoinPassword(event.target.value)}
            placeholder="Mật khẩu phòng"
          />
          <button>Vào phòng tập trung</button>
        </form>
      </main>
    );
  if (!room) return <main className={styles.roomLoading}>Đang chuẩn bị không gian học…</main>;
  return (
    <main className={`${styles.focusRoom} ${styles[theme]}`}>
      {themeVideos[theme].youtubeId ? (
        <iframe
          key={theme}
          className={styles.youtubeBackground}
          title={`Video nền ${themeNames[theme]}`}
          src={`https://www.youtube-nocookie.com/embed/${themeVideos[theme].youtubeId}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&iv_load_policy=3&playsinline=1&rel=0&start=${themeVideos[theme].start}`}
          allow="autoplay; encrypted-media"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <video
          key={theme}
          ref={backgroundVideo}
          className={styles.backgroundVideo}
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          preload="auto"
          src={themeVideos[theme].src}
        />
      )}
      <div className={styles.roomShade} />
      <div className={styles.videoBadge}>● {themeVideos[theme].label}</div>
      <div className={styles.roomTop}>
        <div>
          <span className={styles.liveDot} /> <small>{room.topic || 'FOCUS ROOM'}</small>
          <h1>{room.name}</h1>
        </div>
        <div className={styles.roomTopActions}>
          <button onClick={copyLink}>
            <FiCopy /> Mời bạn
          </button>
          <button onClick={leave}>
            <FiLogOut /> {isHost ? 'Kết thúc' : 'Rời phòng'}
          </button>
        </div>
      </div>
      <div className={styles.roomLayout}>
        <aside className={styles.glassPanel}>
          <h2>
            <FiUsers /> Thành viên{' '}
            <span>
              {participants.length}/{room.maxMembers}
            </span>
          </h2>
          <div className={styles.memberList}>
            {participants.map((p) => (
              <div className={styles.member} key={userId(p)}>
                <div className={styles.avatarWrap}>
                  <img src={p.user?.photo} alt="" />
                  <i />
                </div>
                <span>
                  <b>
                    {p.user?.first_name} {p.user?.last_name}
                  </b>
                  <small>{p.role === 'host' ? 'Chủ phòng' : 'Đang học'}</small>
                </span>
                {p.micEnabled ? <FiMic className={styles.micActive} /> : <FiMicOff />}
                {isHost && p.role !== 'host' && (
                  <div className={styles.memberActions}>
                    {p.micEnabled && (
                      <button
                        title="Tắt mic thành viên"
                        aria-label="Tắt mic thành viên"
                        onClick={() => muteParticipant(userId(p))}
                      >
                        <FiMicOff />
                      </button>
                    )}
                    <button
                      title="Mời rời phòng"
                      aria-label="Mời rời phòng"
                      onClick={() => socket?.emit('focus_kick', { roomId, userId: userId(p) })}
                    >
                      <FiX />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {isHost && (
            <section className={styles.hostMicPanel}>
              <div>
                <FiMic />
                <span>
                  <b>Quyền micro</b>
                  <small>
                    {room.allowMicrophones !== false
                      ? 'Thành viên được tự bật hoặc tắt mic'
                      : 'Micro đang bị khóa với toàn bộ phòng'}
                  </small>
                </span>
              </div>
              <button
                className={
                  room.allowMicrophones !== false ? styles.micPolicyOpen : styles.micPolicyLocked
                }
                onClick={() => updateMicPolicy(room.allowMicrophones === false)}
              >
                {room.allowMicrophones !== false ? 'Khóa mic toàn phòng' : 'Cho phép bật mic'}
              </button>
            </section>
          )}
          <div className={styles.ambientBox}>
            <h3>
              <FiHeadphones /> Âm thanh riêng
            </h3>
            <p>
              {ambient.songCount} bài lo-fi · {ambient.mixCount} mix dài, phát riêng trên thiết bị
              và không truyền vào mic.
            </p>
            <select
              aria-label="Chọn nhạc lo-fi"
              value={ambient.trackId}
              onChange={(event) => ambient.setTrackId(event.target.value)}
            >
              {ambient.tracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.title} · {track.duration}
                </option>
              ))}
            </select>
            <small className={styles.nowPlaying}>
              Đang phát: {ambient.nowPlaying.title} · {ambient.nowPlaying.duration}
            </small>
            <div>
              <button
                onClick={() => ambient.play().catch(() => toast.error('Không phát được nhạc'))}
                disabled={ambient.playing}
              >
                <FiVolume2 />
              </button>
              <button onClick={ambient.stop} disabled={!ambient.playing}>
                <FiVolumeX />
              </button>
              <input
                aria-label="Âm lượng"
                type="range"
                min="0"
                max="100"
                value={ambient.volume}
                onChange={(e) => ambient.setVolume(Number(e.target.value))}
              />
            </div>
            <a href={ambient.track.source} target="_blank" rel="noreferrer">
              Purrple Cat · CC BY 4.0
            </a>
          </div>
        </aside>
        <section className={styles.centerStage}>
          <div className={styles.timerCard}>
            <span>{pomodoro?.mode === 'break' ? 'ĐANG NGHỈ' : 'ĐANG HỌC'}</span>
            <strong>{displayTime(remaining)}</strong>
            <small>
              {pomodoro?.status === 'paused'
                ? 'Đã tạm dừng'
                : pomodoro?.status === 'running'
                  ? 'Đồng bộ bởi máy chủ'
                  : 'Sẵn sàng bắt đầu'}
            </small>
            {isHost && (
              <div className={styles.timerControls}>
                {pomodoro?.status === 'running' ? (
                  <button onClick={() => controlPomodoro('pause')}>
                    <FiPause />
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      controlPomodoro(pomodoro?.status === 'paused' ? 'resume' : 'start')
                    }
                  >
                    <FiPlay />
                  </button>
                )}
                <button
                  onClick={() =>
                    requestFocusConfirmation(
                      'Đặt lại đồng hồ?',
                      'Tiến độ của phiên Pomodoro hiện tại sẽ trở về thời gian ban đầu.',
                      () => controlPomodoro('reset')
                    )
                  }
                >
                  <FiSquare />
                </button>
              </div>
            )}
            {isHost && (
              <div className={styles.timerSettings}>
                <label>
                  Học{' '}
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={durations.focusMinutes}
                    onChange={(e) =>
                      setDurations({ ...durations, focusMinutes: Number(e.target.value) })
                    }
                  />{' '}
                  phút
                </label>
                <label>
                  Nghỉ{' '}
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={durations.breakMinutes}
                    onChange={(e) =>
                      setDurations({ ...durations, breakMinutes: Number(e.target.value) })
                    }
                  />{' '}
                  phút
                </label>
              </div>
            )}
          </div>
          <div className={styles.roomControls}>
            {audioPlaybackBlocked && (
              <button className={styles.audioUnlock} onClick={enableRoomAudio}>
                <FiVolume2 />
                <span>Bật âm thanh phòng</span>
              </button>
            )}
            <button
              onClick={toggleMic}
              disabled={audioBusy || room.allowMicrophones === false}
              className={micOn ? styles.controlOn : ''}
            >
              {micOn ? <FiMic /> : <FiMicOff />}
              <span>
                {room.allowMicrophones === false
                  ? 'Chủ phòng đã khóa mic'
                  : micOn
                    ? 'Đang bật mic'
                    : 'Bật micro'}
              </span>
            </button>
            {micStatus && <small className={styles.micStatus}>{micStatus}</small>}
            {!micStatus && audioConnected && (
              <small className={styles.audioReady}>Đã kết nối âm thanh phòng</small>
            )}
            <div className={styles.themeSwitch}>
              {Object.entries(themeNames).map(([id, label]) => (
                <button
                  key={id}
                  title={label}
                  className={`${styles.themeDot} ${styles[id]} ${theme === id ? styles.activeThemeDot : ''}`}
                  onClick={() => changeTheme(id)}
                />
              ))}
            </div>
          </div>
        </section>
        <aside className={`${styles.glassPanel} ${styles.chatPanel}`}>
          <h2>
            Trò chuyện{' '}
            <span>
              <FiClock />
            </span>
          </h2>
          <div className={styles.chatMessages}>
            {messages.map((message) => (
              <div className={styles.chatMessage} key={message._id}>
                <img src={message.sender?.photo} alt="" />
                <div>
                  <b>
                    {message.sender?.first_name} {message.sender?.last_name}
                  </b>
                  <p>{message.text}</p>
                  <small>
                    {new Date(message.createdAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </small>
                </div>
              </div>
            ))}
            <div ref={chatBottom} />
          </div>
          <form className={styles.chatForm} onSubmit={send}>
            <input
              maxLength="1000"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Nhắn điều gì đó…"
            />
            <button aria-label="Gửi">
              <FiSend />
            </button>
          </form>
        </aside>
      </div>
      <div ref={audioMount} className={styles.remoteAudio} />
      {focusChallenge && (
        <div className={styles.focusLockBackdrop} role="presentation">
          <form className={styles.focusLockCard} onSubmit={confirmFocusAction}>
            <span>FOCUS LOCK</span>
            <h2>{focusChallenge.title}</h2>
            <p>{focusChallenge.description}</p>
            <label htmlFor="focus-lock-code">
              Nhập chính xác chuỗi <strong>{focusChallenge.code}</strong> để tiếp tục
            </label>
            <input
              id="focus-lock-code"
              autoFocus
              autoComplete="off"
              spellCheck="false"
              maxLength="6"
              value={challengeInput}
              onChange={(event) => setChallengeInput(event.target.value.toUpperCase())}
              placeholder="Nhập mã 6 ký tự"
            />
            <div>
              <button type="button" onClick={() => setFocusChallenge(null)}>
                Ở lại tập trung
              </button>
              <button type="submit" disabled={challengeInput !== focusChallenge.code}>
                Xác nhận
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
