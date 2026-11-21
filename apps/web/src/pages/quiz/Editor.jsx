import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import {
  FiArrowLeft,
  FiPlus,
  FiTrash2,
  FiCopy,
  FiArrowUp,
  FiArrowDown,
  FiCheck,
  FiSave,
  FiFileText,
  FiUpload,
} from 'react-icons/fi';
import { quizRequest, errorMessage } from 'features/quiz/api';
import styles from 'features/quiz/quiz.module.css';
import QuestionImport from 'features/quiz/components/QuestionImport';
import { mergeImportedQuestions } from 'features/quiz/importQuestions';
import { correctAnswers } from 'features/quiz/answers';
import { draftKey, readDraft, writeDraft, clearDraft } from 'features/quiz/editorDraft';

const newQuestion = () => ({
  id: crypto.randomUUID(),
  text: '',
  options: ['', '', '', ''],
  correctIndices: [],
  timeLimit: 20,
  explanation: '',
});
const newQuiz = () => ({
  title: '',
  subject: '',
  description: '',
  visibility: 'private',
  questions: [newQuestion()],
});
export default function QuizEditor() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const userId = useSelector((state) => state.user.userinfo?._id);
  const localKey = draftKey(userId, quizId);
  const hydrated = useRef(null);
  const [quiz, setQuiz] = useState(newQuiz);
  const [draftStatus, setDraftStatus] = useState('');
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [importMode, setImportMode] = useState(null);
  const query = useQuery({
    queryKey: ['quiz-edit', quizId],
    queryFn: () => quizRequest('GET', `/quizzes/${quizId}`),
    enabled: !!quizId,
    retry: false,
  });
  useEffect(() => {
    if (hydrated.current === localKey || (quizId && !query.data)) return;
    const saved = readDraft(localKey);
    if (saved) {
      setQuiz(saved);
      setDirty(true);
      setDraftStatus('restored');
    } else if (query.data) setQuiz(query.data.quiz);
    hydrated.current = localKey;
  }, [query.data, quizId, localKey]);
  useEffect(() => {
    const warn = (event) => {
      if (dirty && draftStatus === 'error') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, draftStatus]);
  function update(patch) {
    const next = { ...quiz, ...patch };
    setQuiz(next);
    setDirty(true);
    try {
      writeDraft(localKey, next);
      setDraftStatus('saved');
    } catch {
      setDraftStatus('error');
    }
  }
  function updateQuestion(patch) {
    update({
      questions: quiz.questions.map((question, index) =>
        index === active ? { ...question, ...patch } : question
      ),
    });
  }
  function move(direction) {
    const next = active + direction;
    if (next < 0 || next >= quiz.questions.length) return;
    const questions = [...quiz.questions];
    [questions[active], questions[next]] = [questions[next], questions[active]];
    update({ questions });
    setActive(next);
  }
  function importQuestions(questions) {
    const merged = mergeImportedQuestions(quiz.questions, questions);
    update({ questions: merged.questions });
    setActive(merged.active);
    setImportMode(null);
    setError('');
  }
  async function save(status) {
    setBusy(true);
    setError('');
    try {
      await quizRequest(quizId ? 'PUT' : 'POST', quizId ? `/quizzes/${quizId}` : '/quizzes', {
        ...quiz,
        status,
      });
      setDirty(false);
      clearDraft(localKey);
      client.invalidateQueries(['quiz-library']);
      client.removeQueries(['quiz-edit', quizId]);
      navigate('/quiz?view=mine');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  function leave(event) {
    if (
      dirty &&
      draftStatus === 'error' &&
      !window.confirm('Chưa lưu được bản tạm. Rời trang có thể mất nội dung. Bạn vẫn muốn rời?')
    )
      event.preventDefault();
  }
  function discardDraft() {
    if (!window.confirm('Bỏ phần đang soạn và trở về nội dung đã lưu trên hệ thống?')) return;
    if (!clearDraft(localKey)) {
      setDraftStatus('error');
      return;
    }
    setQuiz(query.data?.quiz || newQuiz());
    setActive(0);
    setDirty(false);
    setDraftStatus('');
  }
  const question = quiz.questions[active];
  if (quizId && query.isLoading)
    return (
      <main className={styles.page}>
        <p className={styles.empty}>Đang tải bộ đề...</p>
      </main>
    );
  if (query.isError)
    return (
      <main className={styles.page}>
        <p className={styles.error}>{errorMessage(query.error)}</p>
        <Link to="/quiz">Về thư viện</Link>
      </main>
    );
  return (
    <main className={styles.page}>
      <div className={styles.page_heading}>
        <div>
          <Link to="/quiz" onClick={leave} className={styles.back}>
            <FiArrowLeft /> Thư viện quiz
          </Link>
          <h1>{quizId ? 'Chỉnh sửa bộ đề' : 'Tạo bộ đề mới'}</h1>
          <p>Trắc nghiệm 4 lựa chọn · Một hoặc nhiều đáp án đúng</p>
        </div>
        <div className={styles.button_group}>
          <button className={styles.secondary} disabled={busy} onClick={() => save('draft')}>
            <FiSave /> Lưu nháp
          </button>
          <button className={styles.primary} disabled={busy} onClick={() => save('ready')}>
            <FiCheck /> {busy ? 'Đang lưu...' : 'Lưu và sẵn sàng'}
          </button>
        </div>
      </div>
      <div className={styles.draft_notice} role="status">
        <div>
          <strong>
            {draftStatus === 'error'
              ? 'Không lưu tạm được trên trình duyệt'
              : draftStatus === 'restored'
                ? 'Đã khôi phục nội dung đang soạn'
                : draftStatus === 'saved'
                  ? 'Đã lưu tạm trên trình duyệt'
                  : 'Tự lưu tạm khi bạn chỉnh sửa'}
          </strong>
          <p className={styles.hint}>
            Bản tạm chỉ có trên trình duyệt này. Bấm “Lưu nháp” hoặc “Lưu và sẵn sàng” để lưu lên hệ
            thống.
          </p>
        </div>
        {dirty && (
          <button className={styles.text_button} onClick={discardDraft} disabled={busy}>
            Bỏ bản lưu tạm
          </button>
        )}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <section className={styles.panel}>
        <div className={styles.form_grid}>
          <label className={styles.field}>
            Tên bộ đề *
            <input
              value={quiz.title}
              maxLength={120}
              placeholder="Ví dụ: Ôn tập Cơ sở dữ liệu"
              onChange={(event) => update({ title: event.target.value })}
            />
          </label>
          <label className={styles.field}>
            Môn học
            <input
              value={quiz.subject}
              maxLength={80}
              placeholder="Cơ sở dữ liệu"
              onChange={(event) => update({ subject: event.target.value })}
            />
          </label>
          <label className={styles.field}>
            Mô tả
            <textarea
              value={quiz.description}
              maxLength={1000}
              rows={2}
              onChange={(event) => update({ description: event.target.value })}
              placeholder="Bộ đề này giúp ôn tập những gì?"
            />
          </label>
          <label className={styles.field}>
            Quyền truy cập
            <select
              value={quiz.visibility}
              onChange={(event) => update({ visibility: event.target.value })}
            >
              <option value="private">Riêng tư — chỉ bạn mở phòng</option>
              <option value="public">Công khai — mọi người có thể mở phòng</option>
            </select>
            <small>Người chơi có mã phòng vẫn tham gia được bộ đề riêng tư.</small>
          </label>
        </div>
      </section>
      <div className={styles.import_toolbar}>
        <div>
          <strong>Tạo câu hỏi nhanh</strong>
          <p className={styles.hint}>
            Dán cả bộ đề hoặc nhập từ file Excel rồi kiểm tra trước khi thêm.
          </p>
        </div>
        <div className={styles.button_group}>
          <button className={styles.outline} disabled={busy} onClick={() => setImportMode('text')}>
            <FiFileText /> Dán đề hàng loạt
          </button>
          <button className={styles.outline} disabled={busy} onClick={() => setImportMode('excel')}>
            <FiUpload /> Nhập Excel
          </button>
        </div>
      </div>
      <div className={styles.editor_layout}>
        <aside className={styles.panel}>
          <div className={styles.row_between}>
            <h2>Câu hỏi</h2>
            <span className={styles.badge}>{quiz.questions.length}/100</span>
          </div>
          <div className={styles.question_list}>
            {quiz.questions.map((item, index) => (
              <button
                key={item.id}
                onClick={() => setActive(index)}
                className={active === index ? styles.question_active : ''}
              >
                <span>{index + 1}</span>
                <span>{item.text || 'Câu hỏi mới'}</span>
              </button>
            ))}
          </div>
          <button
            className={styles.outline}
            disabled={quiz.questions.length >= 100}
            onClick={() => {
              update({ questions: [...quiz.questions, newQuestion()] });
              setActive(quiz.questions.length);
            }}
          >
            <FiPlus /> Thêm câu hỏi
          </button>
        </aside>
        <section className={styles.panel}>
          {question ? (
            <>
              <div className={styles.row_between}>
                <h2>Câu {active + 1}</h2>
                <div className={styles.button_group}>
                  <button
                    className={styles.icon_button}
                    aria-label="Đưa câu hỏi lên"
                    disabled={active === 0}
                    onClick={() => move(-1)}
                  >
                    <FiArrowUp />
                  </button>
                  <button
                    className={styles.icon_button}
                    aria-label="Đưa câu hỏi xuống"
                    disabled={active === quiz.questions.length - 1}
                    onClick={() => move(1)}
                  >
                    <FiArrowDown />
                  </button>
                  <button
                    className={styles.icon_button}
                    aria-label="Nhân đôi câu hỏi"
                    disabled={quiz.questions.length >= 100}
                    onClick={() => {
                      const questions = [...quiz.questions];
                      questions.splice(active + 1, 0, {
                        ...question,
                        id: crypto.randomUUID(),
                        options: [...question.options],
                      });
                      update({ questions });
                      setActive(active + 1);
                    }}
                  >
                    <FiCopy />
                  </button>
                  <button
                    className={styles.icon_button}
                    aria-label="Xóa câu hỏi"
                    onClick={() => {
                      update({ questions: quiz.questions.filter((_, index) => index !== active) });
                      setActive(Math.max(0, active - 1));
                    }}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
              <label className={styles.field}>
                Nội dung câu hỏi *
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={question.text}
                  placeholder="Nhập câu hỏi của bạn..."
                  onChange={(event) => updateQuestion({ text: event.target.value })}
                />
              </label>
              <p className={styles.hint}>
                Tích tất cả đáp án đúng. Nếu A và B đúng, tích cả hai ô A, B. Người chơi cần chọn đủ
                và không chọn thừa mới được điểm.
              </p>
              <div className={styles.options_grid}>
                {question.options.map((option, index) => (
                  <div
                    key={index}
                    className={`${styles.option_editor} ${correctAnswers(question).includes(index) ? styles.option_correct : ''}`}
                  >
                    <input
                      type="checkbox"
                      name="correct"
                      aria-label={`Đáp án đúng ${'ABCD'[index]}`}
                      checked={correctAnswers(question).includes(index)}
                      onChange={() => {
                        const current = correctAnswers(question);
                        const next = current.includes(index)
                          ? current.filter((value) => value !== index)
                          : [...current, index].sort((a, b) => a - b);
                        updateQuestion({ correctIndices: next, correctIndex: next[0] ?? null });
                      }}
                    />
                    <span>{'ABCD'[index]}</span>
                    <input
                      aria-label={`Đáp án ${'ABCD'[index]}`}
                      value={option}
                      maxLength={500}
                      placeholder={`Nội dung đáp án ${'ABCD'[index]}`}
                      onChange={(event) =>
                        updateQuestion({
                          options: question.options.map((value, position) =>
                            position === index ? event.target.value : value
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <div className={styles.form_grid}>
                <label className={styles.field}>
                  Thời gian trả lời
                  <select
                    value={question.timeLimit}
                    onChange={(event) => updateQuestion({ timeLimit: Number(event.target.value) })}
                  >
                    {[...new Set([5, 10, 15, 20, 30, 45, 60, 90, 120, 180, question.timeLimit])]
                      .sort((a, b) => a - b)
                      .map((seconds) => (
                        <option key={seconds} value={seconds}>
                          {seconds} giây
                        </option>
                      ))}
                  </select>
                </label>
                <label className={styles.field}>
                  Giải thích đáp án
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={question.explanation}
                    placeholder="Hiện sau khi người chơi trả lời"
                    onChange={(event) => updateQuestion({ explanation: event.target.value })}
                  />
                </label>
              </div>
            </>
          ) : (
            <div className={styles.empty}>
              <p>Thêm câu hỏi để bắt đầu. Bản sẵn sàng cần ít nhất một câu.</p>
            </div>
          )}
        </section>
      </div>
      {importMode && (
        <QuestionImport
          mode={importMode}
          onClose={() => setImportMode(null)}
          onImport={importQuestions}
          existingCount={mergeImportedQuestions(quiz.questions, []).questions.length}
        />
      )}
    </main>
  );
}
