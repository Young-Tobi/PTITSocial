import { Link } from 'react-router-dom';
import { FiAward, FiCopy } from 'react-icons/fi';
import { Avatar, Standings, points, Tag } from 'features/coding/components';
import SubmissionHistory from 'features/coding/SubmissionHistory';
import { clock } from 'features/coding/api';
import styles from 'features/coding/contest.module.css';
export default function Results({ data }) {
  const { room, me, leaderboard, problems, submissions } = data;
  const own = leaderboard.find((player) => player.userId === me.userId);
  return (
    <>
      <div className={styles.hero}>
        <FiAward />
        <h1>
          {room.status === 'finished'
            ? 'Cuộc thi đã kết thúc'
            : me.left
              ? 'Bạn đã rời cuộc thi'
              : 'Bạn đã giải xong bộ đề!'}
        </h1>
        <p>
          {room.title} · {room.problemCount} đề · {room.durationMinutes} phút · {leaderboard.length}{' '}
          người thi
        </p>
        {room.status !== 'finished' && <p>Bảng điểm vẫn cập nhật khi những người khác đang thi.</p>}
        {room.finishReason === 'host_ended' && <Tag>Người tổ chức kết thúc sớm</Tag>}
        {room.legacy && (
          <p className={styles.note}>
            Phòng được lưu từ phiên bản cũ, khi người tạo phòng còn tham gia thi. Bài làm và bảng
            điểm cũ được giữ nguyên.
          </p>
        )}
      </div>
      {leaderboard.length > 0 && (
        <div className={styles.podium}>
          {leaderboard.slice(0, 3).map((player) => (
            <div className={`${styles.panel} ${styles.podium_card}`} key={player.userId}>
              <small>HẠNG {player.rank}</small>
              <Avatar name={player.name} photo={player.photo} />
              <strong>{player.name}</strong>
              <b>{points(player.points)}</b>
              <small>
                điểm ·{' '}
                {player.elapsedSeconds === null ? 'Chưa ghi điểm' : clock(player.elapsedSeconds)}
              </small>
            </div>
          ))}
        </div>
      )}
      <div className={styles.results_grid}>
        <section className={styles.panel}>
          <div className={styles.heading}>
            <h2>Bảng điểm {room.status === 'finished' ? 'cuối cùng' : 'hiện tại'}</h2>
            <Tag>{leaderboard.length} người thi</Tag>
          </div>
          <Standings data={data} />
        </section>
        <aside className={styles.panel}>
          {me.isHost && !room.legacy ? (
            <>
              <h2>Bộ đề cuộc thi</h2>
              {problems.map((p) => (
                <div className={styles.compact_problem} key={p.id}>
                  <span className={styles.letter}>{p.letter}</span>
                  <div>
                    <strong>{p.title}</strong>
                    <small>100 điểm</small>
                  </div>
                </div>
              ))}
              <div className={styles.note}>
                Bạn là người tổ chức, không có điểm thi hoặc bài làm cá nhân. Code của người thi
                được giữ riêng.
              </div>
            </>
          ) : (
            <>
              <h2>Bài làm của bạn</h2>
              {own && (
                <p className={styles.muted}>
                  Hạng {own.rank}/{leaderboard.length} · {points(own.points)}/{room.maxPoints} điểm
                </p>
              )}
              {me.left && (
                <p className={styles.muted}>Điểm đã có được giữ lại; bạn không thể nộp tiếp.</p>
              )}
              {own?.scores.map((score) => (
                <div className={styles.problem_score} key={score.problemId}>
                  <span className={styles.letter}>
                    {problems.find((p) => p.id === score.problemId)?.letter}
                  </span>
                  <strong>{problems.find((p) => p.id === score.problemId)?.title}</strong>
                  <span>{points(score.points)}/100</span>
                </div>
              ))}
              <hr className={styles.divider} />
              <h3>Lịch sử nộp bài</h3>
              <SubmissionHistory submissions={submissions} problems={problems} />
            </>
          )}
        </aside>
      </div>
      <div className={styles.actions}>
        <Link className={styles.secondary} to="/coding">
          ← Danh sách phòng
        </Link>
        {me.isHost && room.status === 'finished' && problems.length > 0 && (
          <Link className={styles.primary} to={'/coding/new?from=' + room.id}>
            <FiCopy /> Tạo cuộc thi mới từ bộ đề này
          </Link>
        )}
      </div>
    </>
  );
}
