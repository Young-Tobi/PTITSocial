import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useCodingRoom from 'features/coding/useCodingRoom';
import { codingRequest, errorMessage } from 'features/coding/api';
import Lobby from './Lobby';
import HostDashboard from './HostDashboard';
import Contest from './Contest';
import Results from './Results';
import styles from 'features/coding/contest.module.css';
function RoomContent({ roomId }) {
  const navigate = useNavigate(),
    query = useCodingRoom(roomId),
    data = query.data;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  async function action(path, body) {
    setBusy(true);
    setError('');
    try {
      const result = await codingRequest('POST', path, body);
      await query.refetch();
      return result;
    } catch (error) {
      setError(errorMessage(error));
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    if (data.me.isHost || data.room.status === 'finished') {
      navigate('/coding');
      return;
    }
    if (
      data.room.status === 'running' &&
      !window.confirm(
        'Rời cuộc thi? Điểm đã có được giữ lại, nhưng bạn không thể tiếp tục nộp bài trong lượt này.'
      )
    )
      return;
    const result = await action('/rooms/' + roomId + '/leave');
    if (result) navigate('/coding');
  }
  async function end() {
    if (
      window.confirm(
        'Kết thúc phòng cho tất cả mọi người? Bài đã nhận vẫn được chấm trước khi chốt kết quả.'
      )
    )
      await action('/rooms/' + roomId + '/end');
  }
  if (!data || [403, 404].includes(query.error?.response?.status))
    return (
      <main className={styles.workspace}>
        <Link to="/coding">← Về danh sách phòng</Link>
        <p className={query.isError ? styles.error : styles.muted}>
          {query.isError ? errorMessage(query.error) : 'Đang tải phòng...'}
        </p>
      </main>
    );
  const { room, me } = data,
    seconds = room.endsAt
      ? Math.max(
          0,
          Math.ceil((+new Date(room.endsAt) - data.serverNow - (now - query.dataUpdatedAt)) / 1000)
        )
      : 0;
  const focusView = room.status === 'running' && !me.isHost && !me.left && !me.solved;
  return (
    <>
      <main className={`${styles.workspace} ${focusView ? styles.focus : ''}`}>
        <div className={styles.room_toolbar}>
          <Link to="/coding">← Thi đấu lập trình</Link>
          <span className={styles.muted}>
            {query.connected ? '● Đã kết nối' : '○ Đang kết nối lại · vẫn tự cập nhật'}
          </span>
          <div className={styles.actions}>
            <button className={styles.secondary} onClick={leave} disabled={busy}>
              {me.isHost || room.status === 'finished' ? 'Về danh sách' : 'Rời phòng'}
            </button>
            {me.isHost && room.status !== 'finished' && (
              <button className={styles.text_button} onClick={end} disabled={busy}>
                {room.status === 'waiting' ? 'Hủy phòng' : 'Kết thúc sớm'}
              </button>
            )}
          </div>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className={styles.success} role="status">
            {notice}
          </p>
        )}
        {query.isError && (
          <p className={styles.error}>
            Mất kết nối tới máy chủ. Đang thử lại; bản nháp vẫn được giữ.
          </p>
        )}
        {room.status === 'waiting' ? (
          <Lobby data={data} busy={busy} action={action} notice={setNotice} />
        ) : room.status === 'finished' || me.left || (!me.isHost && me.solved) ? (
          <Results data={data} />
        ) : me.isHost ? (
          <HostDashboard data={data} seconds={seconds} />
        ) : (
          <Contest data={data} seconds={seconds} busy={busy} action={action} notice={setNotice} />
        )}
      </main>
    </>
  );
}
export default function CodingRoom() {
  const { roomId } = useParams();
  return <RoomContent key={roomId} roomId={roomId} />;
}
