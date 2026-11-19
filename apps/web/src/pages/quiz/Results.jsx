import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FiAward, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { quizRequest, errorMessage, points } from 'features/quiz/api';
import styles from 'features/quiz/quiz.module.css';
import { correctAnswers, selectedAnswers } from 'features/quiz/answers';

export default function Results({ roomId, final, left = false }) {
  const [selected, setSelected] = useState('');
  const query = useQuery({
    queryKey: ['quiz-results', roomId, selected],
    queryFn: () =>
      quizRequest('GET', `/rooms/${roomId}/results${selected ? `?userId=${selected}` : ''}`),
    retry: false,
    refetchInterval: final ? false : 3000,
  });
  if (query.isLoading) return <p className={styles.empty}>Đang tổng hợp kết quả...</p>;
  if (query.isError) return <p className={styles.error}>{errorMessage(query.error)}</p>;
  const { room, leaderboard, review, selected: player, role, isFinal } = query.data;
  return (
    <>
      <div className={styles.result_hero}>
        <FiAward size={42} />
        <h1>
          {isFinal ? 'Quiz đã kết thúc!' : left ? 'Bạn đã rời lượt chơi' : 'Bạn đã hoàn thành!'}
        </h1>
        <p>{room.title}</p>
        {left && <p>Bạn đã rời phòng. Điểm đã được giữ và không thể tiếp tục lượt chơi này.</p>}
        <p>
          {isFinal
            ? `${leaderboard.length} người chơi · Kết quả cuối cùng`
            : 'Đang chờ những người chơi khác. Thứ hạng sẽ tiếp tục cập nhật.'}
        </p>
      </div>
      <div className={styles.podium}>
        {leaderboard.slice(0, 3).map((item, index) => (
          <div
            key={item.userId}
            className={`${styles.podium_card} ${index === 0 ? styles.winner : ''}`}
          >
            <span className={styles.medal}>
              <FiAward /> #{item.rank}
            </span>
            <strong>{item.name}</strong>
            <b>{points(item.score)}</b>
            <small>
              {item.correctCount}/{room.questionCount} câu đúng
            </small>
          </div>
        ))}
      </div>
      <div className={styles.result_layout}>
        <section className={styles.panel}>
          <h2>Bảng xếp hạng</h2>
          <p className={styles.hint}>Cùng điểm được xếp cùng hạng.</p>
          {leaderboard.length ? (
            leaderboard.map((item) => (
              <button
                key={item.userId}
                className={`${styles.rank_row} ${player?.userId === item.userId ? styles.rank_selected : ''}`}
                onClick={() => role === 'host' && setSelected(item.userId)}
                disabled={role !== 'host'}
              >
                <span>#{item.rank}</span>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.left && 'Đã rời · '}
                    {item.correctCount}/{room.questionCount} câu đúng
                  </small>
                </span>
                <b>{points(item.score)}</b>
              </button>
            ))
          ) : (
            <p className={styles.muted}>Chưa có người chơi.</p>
          )}
        </section>
        <section className={styles.panel}>
          <div className={styles.row_between}>
            <h2>{role === 'host' ? 'Chi tiết bài làm' : 'Xem lại bài làm'}</h2>
            {player && (
              <span className={styles.badge}>
                {player.correctCount}/{room.questionCount} câu đúng
              </span>
            )}
          </div>
          <p className={styles.muted}>
            {player?.name}
            {role === 'host' && ' · Chọn người chơi bên trái để xem bài'}
          </p>
          {review.map((question) => (
            <details key={question.id} className={styles.review_item}>
              <summary>
                <span
                  className={question.answer?.correct ? styles.success_text : styles.danger_text}
                >
                  {question.answer?.correct ? <FiCheckCircle /> : <FiXCircle />}
                </span>
                <strong>
                  Câu {question.index}. {question.text}
                </strong>
                <span className={styles.muted}>
                  {question.answer ? `${points(question.answer.points)} đ` : 'Chưa trả lời'}
                </span>
              </summary>
              <div className={styles.review_options}>
                {question.options.map((option, index) => (
                  <p
                    key={index}
                    className={correctAnswers(question).includes(index) ? styles.correct_text : ''}
                  >
                    <b>{'ABCD'[index]}.</b> {option}{' '}
                    {correctAnswers(question).includes(index) && '✓ Đáp án đúng'}
                    {selectedAnswers(question.answer).includes(index) && ' · Đã chọn'}
                  </p>
                ))}
              </div>
              {question.answer?.timedOut && (
                <p className={styles.danger_text}>Hết thời gian trả lời.</p>
              )}
              {question.explanation && <p className={styles.explanation}>{question.explanation}</p>}
            </details>
          ))}
        </section>
      </div>
      <div className={styles.center_actions}>
        <Link className={styles.primary} to="/quiz">
          Về thư viện quiz
        </Link>
        <Link className={styles.secondary} to="/quiz?view=history">
          Lịch sử tham gia
        </Link>
      </div>
    </>
  );
}
