import { Link, NavLink } from 'react-router-dom';
import { Home, Friends, Messenger } from 'shared/icons/index';
import styles from './HomeLeft.module.css';
import QuizIcon from 'features/quiz/components/QuizIcon';
import CodingIcon from 'features/coding/CodingIcon';

const navigation = [
  { to: '/', text: 'Bảng tin', Icon: Home },
  { to: '/friends', text: 'Bạn bè', Icon: Friends },
  { to: '/messages', text: 'Tin nhắn', Icon: Messenger },
  { to: '/quiz', text: 'Quiz', Icon: QuizIcon },
  { to: '/coding', text: 'Thi đấu lập trình', Icon: CodingIcon },
];

export default function HomeLeft({ user }) {
  return (
    <nav className={styles.left_home + ' scrollbar'} aria-label="Main navigation">
      <Link to="/profile" className={styles.left_link + ' hover2'} title="My profile">
        <img src={user?.photo} alt="" />
        <span>
          {user?.first_name} {user?.last_name}
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
