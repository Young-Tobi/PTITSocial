import { FiCopy, FiPlay, FiUsers } from 'react-icons/fi';
import { Avatar, Tag, Visibility } from 'features/coding/components';
import styles from 'features/coding/contest.module.css';
import { supportedLanguages } from 'features/coding/languages';
export default function Lobby({ data, busy, action, notice }) {
  const { room, players, problems, me } = data;
  async function copy() {
    try {
      await navigator.clipboard.writeText(room.code);
      notice('Đã sao chép mã phòng. Gửi mã này để mời bạn bè.');
    } catch {
      notice('Mã phòng: ' + room.code);
    }
  }
  function kick(player) {
    if (window.confirm(`Mời ${player.name} rời phòng? Người này sẽ không thể vào lại phòng này.`))
      action('/rooms/' + room.id + '/kick', { userId: player.userId });
  }
  return (
    <div className={styles.lobby}>
      <div className={styles.heading}>
        <div>
          <div className={styles.row}>
            <Visibility value={room.visibility} />
            <Tag tone="green">Đang chờ</Tag>
          </div>
          <h1 style={{ marginTop: 12 }}>{room.title}</h1>
          <p>
            Người tổ chức: {room.hostName}
            {me.isHost ? ' (Bạn)' : ''}
          </p>
        </div>
        <button className={styles.room_code} onClick={copy} title="Sao chép mã phòng">
          <span>
            <small>MÃ PHÒNG</small>
            {room.code}
          </span>
          <FiCopy size={21} />
        </button>
      </div>
      <div className={styles.lobby_grid}>
        <section className={styles.panel}>
          <div className={styles.heading}>
            <h2>Người tham gia</h2>
            <Tag>
              {players.length}/{room.maxPlayers} người thi
            </Tag>
          </div>
          <div className={styles.organizer}>
            <Avatar name={room.hostName} photo={room.hostPhoto} />
            <div>
              <strong>{room.hostName}</strong>
              <p className={styles.muted} style={{ margin: 0, fontSize: 11 }}>
                Người tổ chức · Không tham gia thi đấu
              </p>
            </div>
          </div>
          <div className={styles.people}>
            {players.map((player) => (
              <div className={styles.person} key={player.userId}>
                <Avatar name={player.name} photo={player.photo} />
                <div>
                  <strong>
                    {player.name}
                    {player.userId === me.userId ? ' (Bạn)' : ''}
                  </strong>
                  <small>{player.online ? 'Đã kết nối' : 'Chưa kết nối trực tiếp'}</small>
                </div>
                {me.isHost && (
                  <button
                    className={styles.tiny}
                    disabled={busy}
                    onClick={() => kick(player)}
                    aria-label={'Mời ' + player.name + ' rời phòng'}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {Array.from({ length: Math.min(4, room.maxPlayers - players.length) }, (_, index) => (
              <div
                className={styles.person}
                key={'empty-' + index}
                style={{ borderStyle: 'dashed', color: '#a0a8b4' }}
              >
                <FiUsers />
                Chỗ còn trống
              </div>
            ))}
          </div>
          <div className={styles.note} style={{ marginTop: 20 }}>
            {room.visibility === 'public'
              ? 'Phòng đang hiển thị trong danh sách công khai. Người khác có thể vào khi còn chỗ.'
              : 'Phòng không hiển thị trong danh sách công khai. Gửi mã phòng cho những người bạn muốn mời.'}
          </div>
        </section>
        <aside className={styles.panel}>
          <h2>Thông tin cuộc thi</h2>
          <dl className={styles.settings}>
            <dt>Số đề</dt>
            <dd>{room.problemCount} đề</dd>
            <dt>Thời lượng</dt>
            <dd>{room.durationMinutes} phút</dd>
            <dt>Ngôn ngữ</dt>
            <dd>{supportedLanguages}</dd>
            <dt>Tổng điểm tối đa</dt>
            <dd>{room.maxPoints} điểm</dd>
          </dl>
          <hr className={styles.divider} />
          {me.isHost ? (
            <>
              <h3>Bộ đề đã chọn</h3>
              {problems.map((problem) => (
                <div className={styles.compact_problem} key={problem.id}>
                  <span className={styles.letter}>{problem.letter}</span>
                  <div>
                    <strong>{problem.title}</strong>
                    <small>
                      {problem.difficulty === 'easy' ? 'Cơ bản' : 'Trung bình'} · 100 điểm
                    </small>
                  </div>
                </div>
              ))}
              <div className={styles.note}>
                Chỉ bạn thấy bộ đề lúc này. Người thi nhận đề khi bạn bắt đầu cuộc thi.
              </div>
              <button
                className={`${styles.primary} ${styles.wide}`}
                style={{ marginTop: 20 }}
                disabled={busy || players.length < 2}
                onClick={() => action('/rooms/' + room.id + '/start')}
              >
                <FiPlay />
                {busy ? 'Đang chuẩn bị...' : 'Bắt đầu cuộc thi'}
              </button>
              <p className={styles.muted} style={{ textAlign: 'center', fontSize: 11 }}>
                Cần ít nhất 2 người thi để bắt đầu.
              </p>
            </>
          ) : (
            <div className={styles.note}>
              Bộ đề sẽ được mở đồng thời cho tất cả khi người tổ chức bắt đầu.
              <p>
                <strong>Đang chờ người tổ chức bắt đầu...</strong>
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
