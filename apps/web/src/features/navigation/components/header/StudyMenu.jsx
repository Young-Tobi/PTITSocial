import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiGrid } from 'react-icons/fi';
import useOnClickOutside from 'shared/hooks/useOnClickOutside';
import styles from './StudyMenu.module.css';

const links = [
  ['/questions', 'Hỏi đáp học tập'],
  ['/documents', 'Kho tài liệu'],
  ['/focus', 'Phòng học tập'],
  ['/study-spots', 'Địa điểm và hẹn học'],
  ['/learning', 'Lộ trình học tập'],
  ['/learning/ai', 'Trợ lý học tập AI'],
  ['/learning/flashcards', 'Flashcard'],
  ['/quiz', 'Quiz'],
  ['/coding', 'Thi đấu lập trình'],
];

export default function StudyMenu({ buttonClass }) {
  const [open, setOpen] = useState(false);
  const container = useRef(null);
  useOnClickOutside(container, open, () => setOpen(false));
  return (
    <div
      ref={container}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <button
        type="button"
        className={buttonClass}
        aria-label="Chức năng học tập"
        title="Chức năng học tập"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <FiGrid size={22} />
      </button>
      {open && (
        <nav className={styles.menu} aria-label="Chức năng học tập">
          {links.map(([to, text]) => (
            <Link key={to} to={to} onClick={() => setOpen(false)}>
              {text}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
