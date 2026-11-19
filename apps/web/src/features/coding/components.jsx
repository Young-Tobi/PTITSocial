import { FiCheck, FiLock, FiGlobe } from 'react-icons/fi';
import { clock } from './api';
import styles from './contest.module.css';
export const points = (value) =>
  Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
export function Tag({ children, tone = '' }) {
  return <span className={`${styles.tag} ${styles[tone] || ''}`}>{children}</span>;
}
export function Visibility({ value }) {
  return (
    <Tag>
      {value === 'private' ? (
        <>
          <FiLock /> Riêng tư
        </>
      ) : (
        <>
          <FiGlobe /> Công khai
        </>
      )}
    </Tag>
  );
}
export function Avatar({ name, photo }) {
  return photo ? (
    <img className={styles.avatar} src={photo} alt="" />
  ) : (
    <span className={styles.avatar}>
      {name
        ?.split(' ')
        .map((word) => word[0])
        .slice(0, 2)
        .join('')}
    </span>
  );
}
export function ProblemDetails({ problem }) {
  return (
    <>
      <div className={styles.row}>
        <Tag tone="rose">Đề {problem.letter}</Tag>
        <Tag tone={problem.difficulty === 'easy' ? 'green' : 'orange'}>
          {problem.difficulty === 'easy' ? 'Cơ bản' : 'Trung bình'}
        </Tag>
      </div>
      <h2>{problem.title}</h2>
      <div className={styles.limits}>
        100 điểm · Giới hạn cơ sở: {problem.timeLimit} giây ·{' '}
        {Math.round(problem.memoryLimit / 1024)} MB
      </div>
      <p>{problem.description}</p>
      <h3>Dữ liệu vào</h3>
      <p>{problem.inputFormat}</p>
      <h3>Dữ liệu ra</h3>
      <p>{problem.outputFormat}</p>
      <h3>Ràng buộc</h3>
      <p>{problem.constraints}</p>
      {problem.samples.map((sample, index) => (
        <div key={index}>
          <h3>Ví dụ {index + 1}</h3>
          <small className={styles.muted}>Input</small>
          <pre>{sample.input}</pre>
          <small className={styles.muted}>Output</small>
          <pre>{sample.output}</pre>
        </div>
      ))}
    </>
  );
}
export function Standings({ data }) {
  return (
    <>
      <div className={styles.table_scroll}>
        <table>
          <thead>
            <tr>
              <th>Hạng</th>
              <th>Người thi</th>
              {data.problems.map((p) => (
                <th key={p.id} title={p.title}>
                  Đề {p.letter}
                  <br />
                  /100
                </th>
              ))}
              <th>Tổng / {data.room.maxPoints}</th>
              <th>Đạt điểm lúc</th>
            </tr>
          </thead>
          <tbody>
            {data.leaderboard.map((player) => (
              <tr
                key={player.userId}
                className={player.userId === data.me.userId ? styles.own_row : ''}
              >
                <td>#{player.rank}</td>
                <td>
                  <span className={styles.row}>
                    <Avatar name={player.name} photo={player.photo} />
                    <strong>
                      {player.name}
                      {player.userId === data.me.userId ? ' (Bạn)' : ''}
                    </strong>
                  </span>
                  {player.left && <small>Đã rời cuộc thi</small>}
                </td>
                {player.scores.map((score) => (
                  <td
                    key={score.problemId}
                    className={score.solved ? styles.score : styles.partial}
                    title={`${score.passed}/${score.total} test đúng`}
                  >
                    {points(score.points)} {score.solved && <FiCheck />}
                  </td>
                ))}
                <td>
                  <strong>{points(player.points)}</strong>
                </td>
                <td>{player.elapsedSeconds === null ? '—' : clock(player.elapsedSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.leaderboard.length && <p className={styles.muted}>Chưa có người thi.</p>}
      <p className={styles.muted} style={{ fontSize: 11, marginTop: 17 }}>
        Ưu tiên tổng điểm; bằng điểm xét thời điểm server nhận bài đạt tổng điểm đó. Mỗi đề tối đa
        100 điểm.
      </p>
    </>
  );
}
