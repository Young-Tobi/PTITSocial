import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiPlus, FiCode, FiBookOpen, FiClock, FiUsers, FiArrowRight, FiLock } from 'react-icons/fi';
import CodingNavigation, { codingViews } from 'features/coding/CodingNavigation';
import { codingRequest, errorMessage, roomLabel } from 'features/coding/api';
import { Tag, Visibility } from 'features/coding/components';
import styles from 'features/coding/contest.module.css';
import { supportedLanguages } from 'features/coding/languages';
export default function CodingLibrary() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = codingViews.some(([id]) => id === params.get('view'))
    ? params.get('view')
    : 'discover';
  const [code, setCode] = useState(''),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('all'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const rooms = useQuery({
    queryKey: ['coding-library', view],
    queryFn: () => codingRequest('GET', '/rooms?view=' + view),
    refetchInterval: 5000,
  });
  const judge = useQuery({
    queryKey: ['coding-judge'],
    queryFn: () => codingRequest('GET', '/status'),
    refetchInterval: 15000,
  });
  async function join(event, id) {
    event?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await codingRequest(
        'POST',
        id ? `/rooms/${id}/join` : '/rooms/join',
        id ? {} : { code }
      );
      navigate('/coding/rooms/' + data.room.id);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const list = (rooms.data?.rooms || []).filter(
    (room) =>
      room.title.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')) &&
      (status === 'all' || room.status === status)
  );
  return (
    <>
      <main className={`${styles.workspace} ${styles.library}`}>
        <CodingNavigation
          view={view}
          onChange={(view) => {
            setParams({ view });
            setStatus('all');
            setSearch('');
          }}
        />
        <section className={styles.library_main}>
          <div className={styles.heading}>
            <div>
              <h1>Thi đấu lập trình</h1>
              <p>Tìm một cuộc thi, thử sức với đề hay và kết nối cùng bạn bè.</p>
            </div>
            <Link className={styles.primary} to="/coding/new">
              <FiPlus /> Tạo phòng
            </Link>
          </div>
          {!judge.isLoading && !judge.data?.ready && (
            <p className={styles.muted}>Trình chấm chưa sẵn sàng, vui lòng thử lại sau.</p>
          )}
          <section className={`${styles.panel} ${styles.join}`}>
            <div className={styles.row}>
              <FiLock size={25} />
              <div>
                <strong>Tham gia bằng mã</strong>
              </div>
            </div>
            <form onSubmit={(event) => join(event)}>
              <input
                aria-label="Mã phòng"
                placeholder="Nhập mã phòng 6 chữ số"
                maxLength={6}
                pattern="[0-9]{6}"
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              />
              <button className={styles.secondary} disabled={busy}>
                Tham gia <FiArrowRight />
              </button>
            </form>
          </section>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.toolbar}>
            <input
              aria-label="Tìm phòng theo tên"
              placeholder="Tìm phòng theo tên..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              aria-label="Trạng thái phòng"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="waiting">Đang chờ</option>
              <option value="running">Đang thi</option>
              {view !== 'discover' && <option value="finished">Đã kết thúc</option>}
            </select>
          </div>
          {rooms.isLoading ? (
            <p className={styles.muted}>Đang tải danh sách phòng...</p>
          ) : rooms.isError ? (
            <p className={styles.error}>{errorMessage(rooms.error)}</p>
          ) : list.length ? (
            <div className={styles.room_grid}>
              {list.map((room) => (
                <article className={`${styles.panel} ${styles.room_card}`} key={room.id}>
                  <div className={`${styles.row} ${styles.wrap}`}>
                    <Tag
                      tone={
                        room.status === 'waiting'
                          ? 'green'
                          : room.status === 'running'
                            ? 'orange'
                            : ''
                      }
                    >
                      {roomLabel(room.status)}
                    </Tag>
                    <Visibility value={room.visibility} />
                  </div>
                  <div>
                    <h2>{room.title}</h2>
                    <p className={styles.muted}>
                      Người tổ chức: {room.hostName}
                      {room.isHost ? ' (Bạn)' : ''}
                    </p>
                  </div>
                  <div className={styles.meta}>
                    <span>
                      <FiBookOpen />
                      {room.problemCount} đề
                    </span>
                    <span>
                      <FiClock />
                      {room.durationMinutes} phút
                    </span>
                    <span>
                      <FiUsers />
                      {room.playerCount}/{room.maxPlayers} người
                    </span>
                    <span>
                      <FiCode />
                      {supportedLanguages}
                    </span>
                  </div>
                  <div className={styles.card_footer}>
                    <span className={styles.muted}>{room.maxPoints} điểm tối đa</span>
                    {room.isHost || room.hasJoined ? (
                      <Link
                        className={`${styles.secondary} ${styles.small}`}
                        to={'/coding/rooms/' + room.id}
                      >
                        {room.status === 'finished' || room.left
                          ? 'Xem kết quả'
                          : room.isHost
                            ? 'Quản lý phòng'
                            : 'Về phòng'}{' '}
                        <FiArrowRight />
                      </Link>
                    ) : (
                      <button
                        className={`${styles.secondary} ${styles.small}`}
                        disabled={busy || !room.canJoin}
                        onClick={() => join(null, room.id)}
                      >
                        {room.canJoin
                          ? 'Vào phòng'
                          : room.status !== 'waiting'
                            ? 'Đã bắt đầu'
                            : room.playerCount >= room.maxPlayers
                              ? 'Phòng đã đầy'
                              : 'Không thể tham gia'}{' '}
                        {room.canJoin && <FiArrowRight />}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <FiCode size={36} />
              <h2>Chưa có phòng phù hợp</h2>
              <p>Tạo phòng mới hoặc nhập mã để tham gia cùng bạn bè.</p>
            </div>
          )}
          <div className={styles.note} style={{ marginTop: 22 }}>
            Người tổ chức điều hành cuộc thi và không chiếm chỗ thi đấu. Bạn chỉ có thể tham gia
            phòng đang chờ và còn chỗ. Phòng riêng đã vào nằm trong mục “Đang tham gia”.
          </div>
        </section>
      </main>
    </>
  );
}
