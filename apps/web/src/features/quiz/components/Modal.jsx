import { useEffect, useRef } from 'react';
import { FiX } from 'react-icons/fi';
import styles from '../quiz.module.css';

export default function Modal({ title, onClose, children, wide = false }) {
  const panel = useRef();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') close.current();
      if (event.key === 'Tab') {
        const fields = panel.current.querySelectorAll(
          'button:not(:disabled),input,select,a[href],textarea'
        );
        const first = fields[0],
          last = fields[fields.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className={styles.modal_backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`${styles.modal} ${wide ? styles.wide_modal : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panel}
      >
        <div className={styles.row_between}>
          <h2>{title}</h2>
          <button className={styles.icon_button} onClick={onClose} aria-label="Đóng">
            <FiX />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
