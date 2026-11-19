import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  FiArrowLeft,
  FiCopy,
  FiPlay,
  FiUsers,
  FiClock,
  FiAward,
  FiCheckCircle,
  FiXCircle,
  FiX,
  FiSquare,
  FiCheckSquare,
} from 'react-icons/fi';
import useQuizRoom from 'features/quiz/hooks/useQuizRoom';
import { quizRequest, errorMessage, points } from 'features/quiz/api';
import Modal from 'features/quiz/components/Modal';
import Results from './Results';
import styles from 'features/quiz/quiz.module.css';
import { correctAnswers, selectedAnswers } from 'features/quiz/answers';

export default function QuizRoom() {
  const { roomId } = useParams();
  const client = useQueryClient();
  const navigate = useNavigate();
  const query = useQuizRoom(roomId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [choice, setChoice] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [copied, setCopied] = useState(false);
  const data = query.data;
  useEffect(() => {
    setChoice([]);
  }, [data?.question?.id]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  async function action(path, body, method = 'POST') {
    setBusy(true);
    setError('');
    try {
      const result = await quizRequest(method, `/rooms/${roomId}${path}`, body);
      if (result.left || (path === '/end' && confirmLeave)) {
        client.invalidateQueries(['quiz-library']);
        navigate('/quiz?view=history');
        return;
      }
      if (result.room) client.setQueryData(['quiz-room', roomId], result);
      else await query.refetch();
      client.invalidateQueries(['quiz-results', roomId]);
      setConfirmEnd(false);
    } catch (error) {
      setError(errorMessage(error));
      query.refetch();
    } finally {
      setBusy(false);
    }
  }
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(data.room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Không sao chép tự động được. Hãy chọn và sao chép mã phòng.');
    }
  }
  if (query.isLoading)
    return (
      <main className={styles.page}>
        <p className={styles.empty}>Đang vào phòng...</p>
      </main>
    );
  if (query.isError)
    return (
      <main className={styles.page}>
        <p className={styles.error} role="alert">
          {errorMessage(query.error)}
        </p>
        <Link className={styles.outline} to="/quiz">
          Về thư viện
        </Link>
      </main>
    );
  const { room, role, players, attempt, question, feedback, leaderboard } = data;
  const host = role === 'host';
  // Translate the server deadline to local time, so a client clock offset cannot extend a turn.
  const adjustedNow = now + data.serverNow - query.dataUpdatedAt;
  const remaining = question
    ? Math.min(
        question.timeLimit,
        Math.max(0, Math.ceil((new Date(question.deadline).getTime() - adjustedNow) / 1000))
      )
    : 0;
  const showResults =
    (!host && attempt?.phase === 'completed') ||
    (room.status === 'finished' && (host || attempt?.phase !== 'feedback'));
  return (
    <main className={`${styles.page} ${styles.room_page}`}>
      <div className={styles.room_heading}>
        <Link
          to="/quiz"
          className={styles.back}
          onClick={(event) => {
            if (room.status !== 'finished' && !attempt?.leftAt) {
              event.preventDefault();
              setConfirmLeave(true);
            }
          }}
        >
          <FiArrowLeft /> Thư viện quiz
        </Link>
        <div className={styles.button_group}>
          <span
            className={`${styles.connection} ${query.connected ? styles.connection_online : ''}`}
          >
            {query.connected ? '● Đang kết nối trực tiếp' : '○ Đang đồng bộ định kỳ'}
          </span>
          {room.status !== 'finished' && !attempt?.leftAt && (
            <button
              className={styles.outline}
              disabled={busy}
              onClick={() => setConfirmLeave(true)}
            >
              Rời phòng
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {room.status !== 'finished' && (
        <details className={styles.rules_notice}>
          <summary>
            Thời gian và cách tính điểm · Giới hạn phòng {room.timeLimitMinutes} phút
          </summary>
          <ul>
            <li>
              Mỗi câu có thời gian riêng. Đúng được 700 điểm
              {room.settings.speedBonus
                ? ', cộng tối đa 300 điểm tốc độ; trả lời càng sớm càng nhiều điểm thưởng.'
                : '; phòng này không thưởng tốc độ.'}
            </li>
            <li>
              Câu nhiều đáp án phải chọn đủ đáp án đúng và không chọn thừa. Sai hoặc hết giờ được 0
              điểm.
            </li>
            <li>
              Mất kết nối hoặc tải lại trang vẫn tính thời gian. Bấm “Rời phòng” giữa bài sẽ kết
              thúc lượt chơi, giữ điểm đã có.
            </li>
            <li>
              {room.startedAt
                ? `Phòng kết thúc muộn nhất lúc ${new Date(room.expiresAt).toLocaleString('vi-VN')}.`
                : `Sau khi bắt đầu, phòng có tối đa ${room.timeLimitMinutes} phút; thời gian phòng chờ là 24 giờ.`}{' '}
              Chủ phòng có thể kết thúc sớm.
            </li>
          </ul>
        </details>
      )}
      {showResults ? (
        <Results roomId={roomId} final={room.status === 'finished'} left={!!attempt?.leftAt} />
      ) : room.status === 'waiting' ? (
        <>
          <div className={styles.lobby_title}>
            <span className={styles.eyebrow}>PHÒNG CHỜ</span>
            <h1>{room.title}</h1>
            <p>
              Chủ phòng: {room.host.name} · {room.questionCount} câu hỏi · Tự làm theo tiến độ
            </p>
          </div>
          <div className={styles.lobby_layout}>
            <section className={`${styles.panel} ${styles.code_panel}`}>
              <span className={styles.eyebrow}>MÃ THAM GIA</span>
              <strong className={styles.room_code}>{room.code}</strong>
              <button className={styles.outline} onClick={copyCode}>
                <FiCopy />
                {copied ? 'Đã sao chép' : 'Sao chép mã'}
              </button>
              <p>Mở PTITSocial → Quiz → Nhập mã phòng</p>
              <div className={styles.room_facts}>
                <span>
                  <FiClock /> Thời gian riêng từng câu
                </span>
                <span>
                  <FiAward />{' '}
                  {room.settings.speedBonus ? 'Có thưởng tốc độ' : '700 điểm / câu đúng'}
                </span>
              </div>
              {host ? (
                <>
                  <button
                    className={styles.primary}
                    disabled={busy || !players.length}
                    onClick={() => action('/start')}
                  >
                    <FiPlay /> Bắt đầu quiz
                  </button>
                  <small>Chủ phòng điều phối, không tham gia xếp hạng.</small>
                  <button className={styles.text_button} onClick={() => setConfirmEnd(true)}>
                    Hủy phòng
                  </button>
                </>
              ) : (
                <div className={styles.waiting_notice}>
                  <FiCheckCircle /> Bạn đã vào phòng. Chờ chủ phòng bắt đầu...
                </div>
              )}
            </section>
            <section className={styles.panel}>
              <div className={styles.row_between}>
                <h2>
                  <FiUsers /> Người chơi
                </h2>
                <span className={styles.badge}>
                  {players.length}/{room.settings.maxPlayers}
                </span>
              </div>
              <div className={styles.player_grid}>
                {players.map((player) => (
                  <div key={player.userId} className={styles.player_tile}>
                    <span className={styles.avatar}>{player.name.slice(0, 1)}</span>
                    <strong>{player.name}</strong>
                    <small className={player.online ? styles.success_text : styles.muted}>
                      {player.online ? 'Đã sẵn sàng' : 'Đang ngoại tuyến'}
                    </small>
                    {host && (
                      <button
                        className={styles.icon_button}
                        aria-label={`Loại ${player.name}`}
                        disabled={busy}
                        onClick={() => action(`/players/${player.userId}`, undefined, 'DELETE')}
                      >
                        <FiX />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!players.length && (
                <div className={styles.empty}>
                  <FiUsers size={36} />
                  <h3>Đang đợi người chơi</h3>
                  <p>Gửi mã phòng cho bạn bè để cùng tham gia.</p>
                </div>
              )}
            </section>
          </div>
        </>
      ) : host ? (
        <>
          <div className={styles.page_heading}>
            <div>
              <span className={styles.eyebrow}>ĐANG DIỄN RA · MÃ {room.code}</span>
              <h1>{room.title}</h1>
              <p>Mỗi người chơi đang làm bài theo tiến độ riêng.</p>
            </div>
            <button className={styles.outline} disabled={busy} onClick={() => setConfirmEnd(true)}>
              Kết thúc phòng
            </button>
          </div>
          <div className={styles.stats_grid}>
            <div>
              <FiUsers />
              <b>{players.length}</b>
              <span>Người chơi</span>
            </div>
            <div>
              <FiCheckCircle />
              <b>
                {players.filter((player) => player.completed).length}/{players.length}
              </b>
              <span>Đã hoàn thành</span>
            </div>
            <div>
              <FiAward />
              <b>{points(leaderboard[0]?.score || 0)}</b>
              <span>Điểm cao nhất</span>
            </div>
          </div>
          <section className={styles.panel}>
            <h2>Tiến độ trực tiếp</h2>
            <div className={styles.table_wrap}>
              <table className={styles.progress_table}>
                <thead>
                  <tr>
                    <th>Hạng</th>
                    <th>Người chơi</th>
                    <th>Tiến độ</th>
                    <th>Đúng / sai</th>
                    <th>Điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((ranked) => {
                    const player = players.find((item) => item.userId === ranked.userId);
                    return (
                      <tr key={player.userId}>
                        <td>#{ranked.rank}</td>
                        <td>
                          <strong>{player.name}</strong>
                          <small>
                            {player.leftAt
                              ? 'Đã rời phòng'
                              : player.completed
                                ? 'Hoàn thành'
                                : player.online
                                  ? 'Đang làm bài'
                                  : 'Ngoại tuyến'}
                          </small>
                        </td>
                        <td>
                          <div className={styles.progress_track}>
                            <i
                              style={{
                                width: `${(player.answeredCount / room.questionCount) * 100}%`,
                              }}
                            />
                          </div>
                          <small>
                            {player.answeredCount}/{room.questionCount} câu
                          </small>
                        </td>
                        <td>
                          <span className={styles.success_text}>{player.correctCount}</span> /{' '}
                          <span className={styles.danger_text}>{player.incorrectCount}</span>
                        </td>
                        <td>
                          <b>{points(player.score)}</b>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <>
          <div className={styles.player_topline}>
            <span>
              Câu {attempt.cursor + 1}/{room.questionCount}
            </span>
            <span>
              <FiAward /> {points(attempt.score)} điểm
            </span>
            <span>Chuỗi đúng: {attempt.streak}</span>
          </div>
          <div className={styles.progress_track}>
            <i style={{ width: `${(attempt.answeredCount / room.questionCount) * 100}%` }} />
          </div>
          <section className={`${styles.panel} ${styles.play_panel}`}>
            <div className={styles.row_between}>
              <span className={styles.badge}>{room.title}</span>
              <strong
                className={`${styles.timer} ${remaining <= 5 && !feedback ? styles.danger_text : ''}`}
              >
                <FiClock /> {feedback ? 'Đã trả lời' : `${remaining}s`}
              </strong>
            </div>
            <h1 className={styles.play_question}>{question?.text}</h1>
            <p className={`${styles.hint} ${styles.center_text}`}>
              {question?.selectionMode === 'multiple'
                ? 'Chọn tất cả đáp án đúng. Chọn thiếu hoặc chọn thừa sẽ không được điểm.'
                : 'Chọn một đáp án đúng.'}
            </p>
            <div className={styles.options_grid}>
              {question?.options.map((option, index) => (
                <button
                  key={option.id}
                  disabled={busy || !!feedback || remaining === 0}
                  aria-pressed={
                    feedback
                      ? selectedAnswers(feedback).includes(option.id)
                      : choice.includes(option.id)
                  }
                  className={`${styles.answer_option} ${!feedback && choice.includes(option.id) ? styles.answer_selected : ''} ${feedback && correctAnswers(feedback).includes(option.id) ? styles.answer_correct : ''} ${feedback && selectedAnswers(feedback).includes(option.id) && !correctAnswers(feedback).includes(option.id) ? styles.answer_wrong : ''}`}
                  onClick={() =>
                    setChoice((current) =>
                      question.selectionMode === 'multiple'
                        ? current.includes(option.id)
                          ? current.filter((value) => value !== option.id)
                          : [...current, option.id]
                        : [option.id]
                    )
                  }
                >
                  <span>{'ABCD'[index]}</span>
                  {question.selectionMode === 'multiple' && (
                    <span className={styles.choice_mark}>
                      {(
                        feedback
                          ? selectedAnswers(feedback).includes(option.id)
                          : choice.includes(option.id)
                      ) ? (
                        <FiCheckSquare aria-hidden="true" />
                      ) : (
                        <FiSquare aria-hidden="true" />
                      )}
                    </span>
                  )}
                  {option.text}
                  {feedback && correctAnswers(feedback).includes(option.id) && <FiCheckCircle />}
                </button>
              ))}
            </div>
            {feedback ? (
              <div
                className={`${styles.feedback} ${feedback.correct ? styles.feedback_correct : styles.feedback_wrong}`}
              >
                <h2>
                  {feedback.correct ? <FiCheckCircle /> : <FiXCircle />}{' '}
                  {feedback.timedOut
                    ? 'Hết thời gian!'
                    : feedback.correct
                      ? 'Chính xác!'
                      : 'Chưa chính xác'}{' '}
                  <span>+{points(feedback.points)} điểm</span>
                </h2>
                {feedback.explanation && <p>{feedback.explanation}</p>}
                <button
                  className={styles.primary}
                  disabled={busy}
                  onClick={() => action('/next', { questionId: question.id })}
                >
                  {attempt.answeredCount === room.questionCount || room.status === 'finished'
                    ? 'Xem kết quả'
                    : 'Câu tiếp theo'}
                </button>
              </div>
            ) : (
              <div className={styles.center_actions}>
                <button
                  className={styles.primary}
                  disabled={busy || choice.length === 0 || remaining === 0}
                  onClick={() =>
                    action('/answer', { questionId: question.id, selectedIndices: choice })
                  }
                >
                  {remaining === 0
                    ? 'Đang tổng hợp câu trả lời...'
                    : busy
                      ? 'Đang gửi...'
                      : 'Chốt đáp án'}
                </button>
              </div>
            )}
          </section>
          <p className={`${styles.hint} ${styles.center_text}`}>
            Điểm tính theo thời gian trên máy chủ. Không thể đổi đáp án sau khi chốt.
          </p>
        </>
      )}
      {confirmLeave && (
        <Modal
          title={host ? 'Rời trang phòng quiz?' : 'Rời phòng quiz?'}
          onClose={() => !busy && setConfirmLeave(false)}
        >
          <p>
            {host
              ? 'Bạn là chủ phòng. Có thể giữ phòng để quay lại từ lịch sử, hoặc kết thúc phòng cho tất cả người chơi.'
              : room.status === 'waiting'
                ? 'Bạn có thể nhập lại mã để tham gia khi phòng chưa bắt đầu.'
                : 'Điểm đã có sẽ được giữ. Nếu chưa hoàn thành, rời phòng sẽ kết thúc lượt chơi của bạn và không thể làm tiếp.'}
          </p>
          <div className={styles.modal_actions}>
            <button
              className={styles.secondary}
              disabled={busy}
              onClick={() => setConfirmLeave(false)}
            >
              Ở lại
            </button>
            {host ? (
              <>
                <button
                  className={styles.outline}
                  disabled={busy}
                  onClick={() => navigate('/quiz?view=history')}
                >
                  Rời trang, giữ phòng
                </button>
                <button className={styles.primary} disabled={busy} onClick={() => action('/end')}>
                  Kết thúc phòng và rời
                </button>
              </>
            ) : (
              <button className={styles.primary} disabled={busy} onClick={() => action('/leave')}>
                Xác nhận rời phòng
              </button>
            )}
          </div>
        </Modal>
      )}
      {confirmEnd && (
        <Modal
          title={room.status === 'waiting' ? 'Hủy phòng quiz?' : 'Kết thúc phòng quiz?'}
          onClose={() => !busy && setConfirmEnd(false)}
        >
          <p>
            {room.status === 'waiting'
              ? 'Người chơi sẽ không thể bắt đầu phòng này.'
              : 'Dừng bài làm của tất cả người chơi và chốt kết quả hiện tại.'}
          </p>
          <div className={styles.modal_actions}>
            <button
              className={styles.secondary}
              disabled={busy}
              onClick={() => setConfirmEnd(false)}
            >
              Tiếp tục
            </button>
            <button className={styles.primary} disabled={busy} onClick={() => action('/end')}>
              Xác nhận kết thúc
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
