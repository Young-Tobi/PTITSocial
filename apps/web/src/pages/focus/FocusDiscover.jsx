import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiClock, FiHeadphones, FiLock, FiSearch, FiUsers } from 'react-icons/fi';
import { studyApi, errorMessage } from 'features/study/api';
import toast from 'react-hot-toast';
import styles from './focus.module.css';

export default function FocusDiscover() {
  const [rooms, setRooms] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async (q = '') => {
    setLoading(true);
    try {
      const { data } = await studyApi.get('/focus-rooms', { params: q ? { q } : {} });
      setRooms(data.data.rooms);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const join = async (roomId) => {
    try {
      await studyApi.post(`/focus-rooms/${roomId}/join`, {});
      navigate(`/focus/${roomId}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>STUDY FLUX · FOCUS ROOM</span>
          <h1>
            Học cùng nhau,
            <br />
            tập trung theo cách của bạn.
          </h1>
          <p>
            Không camera. Chỉ có Pomodoro đồng bộ, âm thanh nhẹ nhàng và những người bạn đang cùng
            cố gắng.
          </p>
          <Link className={styles.primaryButton} to="/focus/new">
            + Tạo phòng tập trung
          </Link>
        </div>
        <div className={styles.heroOrb}>
          <FiHeadphones />
          <strong>25:00</strong>
          <span>deep focus</span>
        </div>
      </section>
      <section className={styles.toolbar}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            load(query);
          }}
        >
          <FiSearch />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc chủ đề..."
          />
        </form>
        <span>{rooms.length} phòng đang mở</span>
      </section>
      <section className={styles.roomGrid}>
        {loading && <div className={styles.empty}>Đang tải phòng học…</div>}
        {!loading &&
          rooms.map((room) => (
            <article className={styles.roomCard} key={room._id}>
              <div className={`${styles.themeThumb} ${styles[room.theme]}`}>
                <span>
                  <i /> Đang hoạt động
                </span>
              </div>
              <div className={styles.roomCardBody}>
                <small>{room.topic || 'Học tập tự do'}</small>
                <h2>{room.name}</h2>
                <p>{room.description || 'Một góc yên tĩnh để cùng nhau tập trung.'}</p>
                <div className={styles.roomMeta}>
                  <span>
                    <FiUsers /> {room.memberCount}/{room.maxMembers}
                  </span>
                  <span>
                    <FiClock /> {room.pomodoro?.focusMinutes || 25} phút
                  </span>
                  {room.privacy === 'private' && (
                    <span>
                      <FiLock /> Riêng tư
                    </span>
                  )}
                </div>
                <div className={styles.host}>
                  <img src={room.owner?.photo} alt="" />
                  <span>
                    Chủ phòng
                    <br />
                    <b>
                      {room.owner?.first_name} {room.owner?.last_name}
                    </b>
                  </span>
                </div>
                <button
                  onClick={() => join(room._id)}
                  disabled={room.memberCount >= room.maxMembers}
                >
                  Tham gia phòng
                </button>
              </div>
            </article>
          ))}
        {!loading && !rooms.length && (
          <div className={styles.empty}>Chưa có phòng phù hợp. Hãy tạo không gian đầu tiên.</div>
        )}
      </section>
    </main>
  );
}
