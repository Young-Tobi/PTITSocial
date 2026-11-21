import RoadmapIcon from 'shared/icons/RoadmapIcon';
import { Link, NavLink } from 'react-router-dom';
import { Home, Friends, Messenger } from 'shared/icons/index';
import styles from './HomeLeft.module.css';
import QuizIcon from 'features/quiz/components/QuizIcon';
import CodingIcon from 'features/coding/CodingIcon';
import {
  FiBookOpen,
  FiMessageSquare,
  FiHeadphones,
  FiMapPin,
  FiLayers,
  FiCpu,
} from 'react-icons/fi';

const LearningIcon = () => <RoadmapIcon size={25} style={{ fill: 'none' }} />;
const navigation = [
  { to: '/', text: 'Bảng tin', Icon: Home },
  { to: '/friends', text: 'Bạn bè', Icon: Friends },
  { to: '/messages', text: 'Tin nhắn', Icon: Messenger },
  { to: '/quiz', text: 'Quiz', Icon: QuizIcon },
  { to: '/coding', text: 'Thi đấu lập trình', Icon: CodingIcon },
  { to: '/questions', text: 'Hỏi đáp học tập', Icon: FiMessageSquare },
  { to: '/documents', text: 'Kho tài liệu', Icon: FiBookOpen },
  { to: '/focus', text: 'Phòng học tập', Icon: FiHeadphones },
  { to: '/study-spots', text: 'Địa điểm và hẹn học', Icon: FiMapPin },
  { to: '/learning', text: 'Lộ trình học tập', Icon: LearningIcon },
  { to: '/learning/ai', text: 'Trợ lý học tập AI', Icon: FiCpu },
  { to: '/learning/flashcards', text: 'Flashcard', Icon: FiLayers },
];

export default function HomeLeft({ user }) {
  return (
    <nav className={styles.left_home + ' scrollbar'} aria-label="Main navigation">
      <Link to="/profile" className={styles.left_link + ' hover2'} title="Trang cá nhân của tôi">
        <img src={user?.photo} alt="" />
        <span>
          {user?.last_name} {user?.first_name}
        </span>
      </Link>
      {navigation.map(({ to, text, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to !== '/coding'}
          title={text}
          className={({ isActive }) =>
            [styles.left_link, 'hover2', isActive ? styles.active_link : ''].join(' ')
          }
        >
          <div className={styles.navigation_icon}>
            <Icon />
          </div>
          <span>{text}</span>
        </NavLink>
      ))}
    </nav>
  );
}
