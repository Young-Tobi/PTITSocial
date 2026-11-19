import { FiCompass, FiUsers, FiPlay, FiClock } from 'react-icons/fi';
import styles from 'features/quiz/quiz.module.css';
export const codingViews = [
  ['discover', 'Khám phá phòng', FiCompass],
  ['mine', 'Phòng tôi tổ chức', FiUsers],
  ['joined', 'Đang tham gia', FiPlay],
  ['history', 'Lịch sử thi đấu', FiClock],
];
export default function CodingNavigation({ view, onChange }) {
  return (
    <aside className={styles.side_nav} aria-label="Điều hướng thi đấu lập trình">
      <div className={styles.side_label}>KHÔNG GIAN LẬP TRÌNH</div>
      {codingViews.map(([key, label, Icon]) => (
        <button
          key={key}
          className={view === key ? styles.side_active : ''}
          onClick={() => onChange(key)}
        >
          <Icon />
          {label}
        </button>
      ))}
      <p className={styles.side_note}>Cùng luyện tập, thử sức và kết nối với bạn bè.</p>
    </aside>
  );
}
