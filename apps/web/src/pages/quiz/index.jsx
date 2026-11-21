import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiPlus,
  FiSearch,
  FiPlay,
  FiEdit2,
  FiTrash2,
  FiClock,
  FiBookOpen,
  FiUsers,
  FiCompass,
  FiList,
  FiArrowRight,
} from 'react-icons/fi';
import { quizRequest, errorMessage, points, roomLabel } from 'features/quiz/api';
import Modal from 'features/quiz/components/Modal';
import styles from 'features/quiz/quiz.module.css';

export default function QuizLibrary() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const view = ['mine', 'discover', 'history'].includes(params.get('view'))
    ? params.get('view')
    : 'mine';
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [code, setCode] = useState(params.get('code') || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [settings, setSettings] = useState({
    maxPlayers: 30,
    shuffleOptions: true,
    speedBonus: true,
  });
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const library = useQuery({
    queryKey: ['quiz-library', view, filter, term],
    queryFn: () =>
      quizRequest(
        'GET',
        view === 'history'
          ? '/history'
          : `/quizzes?view=${view}&status=${filter}&search=${encodeURIComponent(term)}`
      ),
    retry: false,
  });
  async function join(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await quizRequest('POST', '/rooms/join', { code });
      navigate(`/quiz/rooms/${result.room.id}`);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function openRoom(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await quizRequest('POST', '/rooms', { quizId: opening.id, ...settings });
      navigate(`/quiz/rooms/${result.room.id}`);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function removeQuiz() {
    setBusy(true);
    setError('');
    try {
      await quizRequest('DELETE', `/quizzes/${deleting.id}`);
      setDeleting(null);
      client.invalidateQueries(['quiz-library']);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const quizzes = library.data?.quizzes || [];
  return (
    <main className={`${styles.page} ${styles.library_layout}`}>
      <aside className={styles.side_nav} aria-label="Điều hướng Quiz">
        <div className={styles.side_label}>KHÔNG GIAN QUIZ</div>
        {[
          ['discover', 'Khám phá quiz', FiCompass],
          ['mine', 'Quiz của tôi', FiBookOpen],
          ['history', 'Lịch sử tham gia', FiClock],
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            className={view === key ? styles.side_active : ''}
            onClick={() => {
              setParams({ view: key });
              setSearch('');
              setError('');
            }}
          >
            <Icon />
            {label}
          </button>
        ))}
        <p className={styles.side_note}>Cùng ôn tập, thử sức và kết nối với bạn bè.</p>
      </aside>
      <section className={styles.library_main}>
        <div className={styles.page_heading}>
          <div>
            <h1>Quiz</h1>
            <p>Tạo bộ đề, mở phòng và cùng bạn bè ôn tập.</p>
          </div>
          <Link to="/quiz/new" className={styles.primary}>
            <FiPlus /> Tạo bộ đề
          </Link>
        </div>
        <form className={styles.join_bar} onSubmit={join}>
          <div>
            <FiUsers size={23} />
            <strong>Tham gia bằng mã</strong>
          </div>
          <label className={styles.sr_only} htmlFor="quiz-code">
            Mã phòng
          </label>
          <input
            id="quiz-code"
            inputMode="numeric"
            placeholder="Nhập mã phòng 6 chữ số"
            value={code}
            maxLength={6}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            required
            pattern="[0-9]{6}"
          />
          <button className={styles.outline} disabled={busy}>
            Tham gia <FiArrowRight />
          </button>
        </form>
        {error && !opening && !deleting && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.list_toolbar}>
          {view === 'mine' ? (
            <div className={styles.tabs}>
              {[
                ['all', 'Tất cả'],
                ['draft', 'Bản nháp'],
                ['ready', 'Sẵn sàng'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={filter === key ? styles.tab_active : ''}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <h2>{view === 'history' ? 'Các phòng đã tham gia' : 'Quiz được chia sẻ công khai'}</h2>
          )}
          {view !== 'history' && (
            <label className={styles.search}>
              <FiSearch />
              <input
                aria-label="Tìm kiếm bộ đề"
                placeholder="Tìm tên quiz, môn học..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          )}
        </div>
        {library.isLoading ? (
          <div className={styles.empty}>Đang tải...</div>
        ) : library.isError ? (
          <div className={styles.empty}>
            <p>{errorMessage(library.error)}</p>
            <button className={styles.outline} onClick={() => library.refetch()}>
              Thử lại
            </button>
          </div>
        ) : view === 'history' ? (
          <div className={styles.history_list}>
            {library.data?.rooms.length ? (
              library.data.rooms.map((room) => (
                <Link className={styles.history_card} key={room.id} to={`/quiz/rooms/${room.id}`}>
                  <span className={styles.history_symbol}>
                    <FiUsers />
                  </span>
                  <div>
                    <h3>{room.title}</h3>
                    <p>
                      Mã {room.code} · {room.role === 'host' ? 'Chủ phòng' : 'Người chơi'} ·{' '}
                      {new Date(room.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`${styles.badge} ${room.status === 'running' ? styles.badge_green : ''}`}
                    >
                      {roomLabel(room.status)}
                    </span>
                    {room.role === 'player' && (
                      <p>
                        {points(room.score)} điểm{room.left && ' · Đã rời'}
                      </p>
                    )}
                  </div>
                  <FiArrowRight />
                </Link>
              ))
            ) : (
              <div className={styles.empty}>
                <FiClock size={36} />
                <h3>Chưa có lịch sử</h3>
                <p>Tạo hoặc tham gia một phòng quiz để bắt đầu.</p>
              </div>
            )}
          </div>
        ) : quizzes.length ? (
          <div className={styles.quiz_grid}>
            {quizzes.map((quiz, index) => (
              <article className={styles.quiz_card} key={quiz.id}>
                <div className={`${styles.quiz_cover} ${styles['cover_' + (index % 4)]}`}>
                  <FiBookOpen size={58} />
                  <span
                    className={`${styles.badge} ${quiz.status === 'ready' ? styles.badge_green : styles.badge_amber}`}
                  >
                    {quiz.status === 'ready' ? '✓ Sẵn sàng' : 'Bản nháp'}
                  </span>
                </div>
                <div className={styles.card_body}>
                  <h2>{quiz.title}</h2>
                  <div className={styles.card_meta}>
                    <span>
                      <FiList />
                      {quiz.questionCount} câu hỏi
                    </span>
                    <span>{quiz.subject || 'Chưa phân môn'}</span>
                  </div>
                  <p>
                    {quiz.isOwner
                      ? quiz.visibility === 'public'
                        ? 'Công khai'
                        : 'Riêng tư'
                      : `Tạo bởi ${quiz.ownerName}`}{' '}
                    · {new Date(quiz.updatedAt).toLocaleDateString('vi-VN')}
                  </p>
                  <div className={styles.card_actions}>
                    {quiz.status === 'ready' ? (
                      <button
                        className={styles.primary}
                        onClick={() => {
                          setOpening(quiz);
                          setError('');
                        }}
                      >
                        <FiPlay /> Mở phòng
                      </button>
                    ) : (
                      <Link className={styles.outline} to={`/quiz/${quiz.id}/edit`}>
                        <FiEdit2 /> Tiếp tục chỉnh sửa
                      </Link>
                    )}
                    {quiz.isOwner && (
                      <>
                        <Link
                          className={styles.icon_button}
                          aria-label={`Chỉnh sửa ${quiz.title}`}
                          to={`/quiz/${quiz.id}/edit`}
                        >
                          <FiEdit2 />
                        </Link>
                        <button
                          className={styles.icon_button}
                          aria-label={`Xóa ${quiz.title}`}
                          onClick={() => {
                            setDeleting(quiz);
                            setError('');
                          }}
                        >
                          <FiTrash2 />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <FiBookOpen size={40} />
            <h3>{view === 'discover' ? 'Chưa có quiz công khai' : 'Chưa có bộ đề phù hợp'}</h3>
            <p>
              {view === 'discover'
                ? 'Bạn có thể tạo và chia sẻ bộ đề với cộng đồng.'
                : 'Tạo bộ đề đầu tiên hoặc thử từ khóa khác.'}
            </p>
            <Link to="/quiz/new" className={styles.primary}>
              <FiPlus /> Tạo bộ đề
            </Link>
          </div>
        )}
      </section>
      {opening && (
        <Modal
          title="Thiết lập phòng quiz"
          onClose={() => {
            if (!busy) setOpening(null);
          }}
        >
          <form onSubmit={openRoom}>
            <p className={styles.muted}>
              {opening.title} · {opening.questionCount} câu hỏi
            </p>
            <label className={styles.field}>
              Số người chơi tối đa
              <input
                type="number"
                min="1"
                max="100"
                value={settings.maxPlayers}
                onChange={(event) =>
                  setSettings({ ...settings, maxPlayers: Number(event.target.value) })
                }
              />
            </label>
            <label className={styles.check_row}>
              <input
                type="checkbox"
                checked={settings.shuffleOptions}
                onChange={(event) =>
                  setSettings({ ...settings, shuffleOptions: event.target.checked })
                }
              />
              Xáo trộn thứ tự đáp án
            </label>
            <label className={styles.check_row}>
              <input
                type="checkbox"
                checked={settings.speedBonus}
                onChange={(event) => setSettings({ ...settings, speedBonus: event.target.checked })}
              />
              Thưởng điểm theo tốc độ trả lời
            </label>
            <p className={styles.hint}>
              Mỗi người tự làm theo tiến độ. Phản hồi đúng/sai hiện ngay sau mỗi câu. Đúng được 700
              điểm.{' '}
              {settings.speedBonus
                ? 'Thưởng thêm tối đa 300 điểm tốc độ, trả lời càng sớm càng nhiều điểm.'
                : 'Phòng này không thưởng tốc độ.'}
            </p>
            <p className={styles.hint}>
              Giới hạn phòng sau khi bắt đầu: <strong>{opening.timeLimitMinutes || 90} phút</strong>
              . Đề dài được cộng thêm thời gian làm bài và đọc phản hồi.
            </p>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button className={styles.primary} disabled={busy}>
              {busy ? 'Đang tạo...' : 'Tạo phòng'}
            </button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Xóa bộ đề?"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <p>
            “{deleting.title}” sẽ được xóa khỏi thư viện. Các phòng và kết quả đã lưu vẫn được giữ.
          </p>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.modal_actions}>
            <button className={styles.secondary} onClick={() => setDeleting(null)} disabled={busy}>
              Hủy
            </button>
            <button className={styles.primary} onClick={removeQuiz} disabled={busy}>
              Xóa bộ đề
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
