import { useState } from 'react';
import Modal from 'features/quiz/components/Modal';
import { Standings, ProblemDetails, Tag, points } from 'features/coding/components';
import { clock } from 'features/coding/api';
import styles from 'features/coding/contest.module.css';
import { languageLabel } from 'features/coding/languages';
export default function HostDashboard({ data, seconds }) {
  const [preview, setPreview] = useState(null);
  const { room, players, problems, activity } = data;
  return (
    <>
      <div className={styles.heading}>
        <div>
          <h1>{room.title}</h1>
          <p>Phòng {room.code} · Bạn điều hành cuộc thi và không có tên trong bảng xếp hạng.</p>
        </div>
      </div>
      <div className={styles.stats}>
        <div className={`${styles.panel} ${styles.stat}`}>
          <span>Thời gian còn lại</span>
          <b style={{ color: '#b8202e' }}>{data.judging ? 'Đang chấm' : clock(seconds)}</b>
          <small>Tổng thời lượng {room.durationMinutes} phút</small>
        </div>
        <div className={`${styles.panel} ${styles.stat}`}>
          <span>Người đang thi</span>
          <b>
            {players.filter((p) => !p.left).length} / {room.maxPlayers}
          </b>
          <small>{players.length} người đã tham gia</small>
        </div>
        <div className={`${styles.panel} ${styles.stat}`}>
          <span>Bài đã nộp</span>
          <b>{data.submissionCount}</b>
          <small>{data.pending} bài đang chờ/chấm</small>
        </div>
        <div className={`${styles.panel} ${styles.stat}`}>
          <span>Bộ đề</span>
          <b>{room.problemCount} đề</b>
          <small>{room.maxPoints} điểm tối đa</small>
        </div>
      </div>
      <div className={styles.host_grid}>
        <section className={styles.panel}>
          <div className={styles.heading}>
            <h2>Bảng điểm trực tiếp</h2>
            <Tag tone="green">{data.judging ? 'Đang chấm bài đã nhận' : 'Đang thi'}</Tag>
          </div>
          <Standings data={data} />
        </section>
        <aside className={styles.stack}>
          <section className={styles.panel}>
            <h2>Bộ đề cuộc thi</h2>
            {problems.map((problem) => (
              <div className={styles.compact_problem} key={problem.id}>
                <span className={styles.letter}>{problem.letter}</span>
                <div>
                  <strong>{problem.title}</strong>
                  <small>
                    100 điểm · {problem.difficulty === 'easy' ? 'Cơ bản' : 'Trung bình'}
                  </small>
                </div>
                <button className={styles.text_button} onClick={() => setPreview(problem)}>
                  Xem
                </button>
              </div>
            ))}
          </section>
          <section className={styles.panel}>
            <h2>Hoạt động gần đây</h2>
            {activity.length ? (
              activity.map((item) => (
                <div className={styles.activity} key={item.id}>
                  <p>
                    <strong>{item.name}</strong> · Đề{' '}
                    {problems.find((p) => p.id === item.problemId)?.letter}
                  </p>
                  <p className={item.status === 'done' ? styles.success : styles.muted}>
                    {item.status === 'done'
                      ? `${points(item.points)}/100 điểm`
                      : item.status === 'error'
                        ? 'Lỗi chấm bài'
                        : item.status === 'queued'
                          ? 'Đang chờ chấm'
                          : 'Đang chấm'}
                  </p>
                  <small>
                    {clock(item.elapsedSeconds)} sau khi bắt đầu · {languageLabel(item.language)}
                  </small>
                </div>
              ))
            ) : (
              <p className={styles.muted}>Chưa có bài nộp.</p>
            )}
            <div className={styles.note} style={{ marginTop: 16 }}>
              Bạn theo dõi điểm và trạng thái bài nộp. Code của người thi được giữ riêng.
            </div>
          </section>
        </aside>
      </div>
      {preview && (
        <Modal title={preview.title} onClose={() => setPreview(null)}>
          <ProblemDetails problem={preview} />
        </Modal>
      )}
    </>
  );
}
