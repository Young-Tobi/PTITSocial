import { useState } from 'react';
import { FiCode } from 'react-icons/fi';
import Modal from 'features/quiz/components/Modal';
import CodeEditor from './CodeEditor';
import { codingRequest, errorMessage, clock } from './api';
import { points } from './components';
import styles from './contest.module.css';
import { getLanguage, languageLabel } from './languages';
export default function SubmissionHistory({ submissions, problems }) {
  const [code, setCode] = useState(null),
    [error, setError] = useState('');
  async function show(id) {
    setError('');
    try {
      const result = await codingRequest('GET', '/submissions/' + id + '/code');
      setCode(result);
    } catch (error) {
      setError(errorMessage(error));
    }
  }
  const list = submissions.filter((item) => item.mode === 'submit');
  return (
    <>
      {list.length ? (
        list.map((item) => (
          <div className={styles.submission_row} key={item.id}>
            <div>
              <strong>
                Đề {problems.find((p) => p.id === item.problemId)?.letter} ·{' '}
                {item.status === 'done'
                  ? `${points(item.points)}/100 điểm`
                  : item.status === 'error'
                    ? 'Lỗi chấm bài'
                    : 'Đang chấm'}
              </strong>
              <p className={styles.muted} style={{ margin: 0, fontSize: 11 }}>
                {clock(item.elapsedSeconds)} sau khi bắt đầu
                {' · '}
                {languageLabel(item.language)}
              </p>
            </div>
            <button className={styles.text_button} onClick={() => show(item.id)}>
              <FiCode /> Xem code
            </button>
          </div>
        ))
      ) : (
        <p className={styles.muted}>Bạn chưa nộp bài.</p>
      )}
      {error && <p className={styles.error}>{error}</p>}
      {code !== null && (
        <Modal title="Code đã nộp của bạn" wide onClose={() => setCode(null)}>
          <p className={styles.muted}>{languageLabel(code.language)}</p>
          <CodeEditor value={code.code} language={getLanguage(code.language).editor} readOnly />
        </Modal>
      )}
    </>
  );
}
