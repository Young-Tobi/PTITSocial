import { FiCheckSquare } from 'react-icons/fi';
import styles from '../quiz.module.css';

export default function QuizIcon({ className = '', ...props }) {
  return <FiCheckSquare className={`${styles.quiz_icon} ${className}`} size={25} {...props} />;
}
