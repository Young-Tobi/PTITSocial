import { useState } from 'react';
import { FiClock, FiCode, FiPlay, FiSend } from 'react-icons/fi';
import CodeEditor from 'features/coding/CodeEditor';
import SubmissionHistory from 'features/coding/SubmissionHistory';
import { ProblemDetails, points } from 'features/coding/components';
import { clock } from 'features/coding/api';
import styles from 'features/coding/contest.module.css';
import { languages, getLanguage } from 'features/coding/languages';
import { readDraft, readLanguage } from 'features/coding/editorDraft';
function ProblemEditor({
  data,
  problem,
  seconds,
  busy,
  action,
  notice,
  language,
  onLanguageChange,
}) {
  const profile = getLanguage(language);
  const draftKey = `coding-draft:${data.me.userId}:${data.room.id}:${problem.id}`;
  const [code, setCode] = useState(() =>
    readDraft(
      localStorage,
      draftKey,
      language,
      language === 'cpp' ? problem.starterCode || profile.starter : profile.starter
    )
  );
  const [tab, setTab] = useState('run');
  const submissions = data.submissions.filter((item) => item.problemId === problem.id),
    latest = submissions.find((item) => (item.language || 'cpp') === language);
  const pending = data.submissions.some((item) => ['queued', 'judging'].includes(item.status));
  const own = data.leaderboard.find((player) => player.userId === data.me.userId),
    score = own?.scores.find((item) => item.problemId === problem.id);
  const readOnly = seconds === 0 || score?.solved || data.me.left;
  function edit(value) {
    setCode(value);
    try {
      localStorage.setItem(`${draftKey}:${language}`, value);
    } catch {
      notice('Không lưu được bản nháp. Hãy giữ trang mở khi làm bài.');
    }
  }
  async function send(mode) {
    setTab(mode === 'run' ? 'run' : 'history');
    await action(`/rooms/${data.room.id}/${mode}`, {
      code,
      problemId: problem.id,
      language,
      requestId: crypto.randomUUID(),
    });
  }
  return (
    <section className={`${styles.panel} ${styles.editor_panel}`}>
      <div className={styles.editor_top}>
        <strong>
          <FiCode /> Lời giải · Đề {problem.letter}
        </strong>
        <select
          aria-label="Ngôn ngữ lập trình"
          value={language}
          onChange={(event) => onLanguageChange(event.target.value)}
        >
          {languages.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
        <small className={styles.muted}>Bản nháp riêng theo đề và ngôn ngữ</small>
      </div>
      <p className={styles.language_hint}>
        {profile.label} · {Math.min(10, problem.timeLimit * profile.timeFactor)} giây CPU
        {language === 'java'
          ? ' · Java: class Main, heap tối đa 128 MB'
          : ` · ${Math.round(problem.memoryLimit / 1024)} MB`}
      </p>
      <CodeEditor value={code} onChange={edit} readOnly={readOnly} language={profile.editor} />
      {pending && !['queued', 'judging'].includes(latest?.status) && (
        <p className={styles.muted}>
          Một bài ở đề hoặc ngôn ngữ khác đang chờ/chấm. Bạn có thể tiếp tục soạn code.
        </p>
      )}
      <div className={styles.editor_actions}>
        <span className={styles.muted} style={{ marginRight: 'auto', fontSize: 11 }}>
          Điểm tốt nhất: {points(score?.points)}/100
        </span>
        <button
          className={styles.secondary}
          disabled={busy || pending || readOnly || !code.trim()}
          onClick={() => send('run')}
        >
          <FiPlay /> Chạy thử
        </button>
        <button
          className={styles.primary}
          disabled={busy || pending || readOnly || !code.trim()}
          onClick={() => send('submit')}
        >
          <FiSend /> Nộp bài
        </button>
      </div>
      {score?.solved && (
        <p className={styles.success}>Bạn đã giải đúng đề này. Hãy chọn đề khác để tiếp tục.</p>
      )}
      <div className={styles.console}>
        <div className={styles.console_tabs}>
          <button
            className={tab === 'run' ? styles.selected_tab : ''}
            onClick={() => setTab('run')}
          >
            Kết quả chạy thử
          </button>
          <button
            className={tab === 'history' ? styles.selected_tab : ''}
            onClick={() => setTab('history')}
          >
            Lịch sử nộp đề {problem.letter}
          </button>
        </div>
        {tab === 'history' ? (
          <>
            <SubmissionHistory submissions={submissions} problems={data.problems} />
            {latest?.compileOutput && <pre>{latest.compileOutput}</pre>}
            {latest?.error && <p className={styles.error}>{latest.error}</p>}
          </>
        ) : !latest ? (
          <>
            <p className={styles.muted}>Chạy thử với ví dụ của đề trước khi nộp bài.</p>
            <div className={styles.note}>
              Chạy thử không tính điểm. Nộp bài để chấm các test ẩn.
            </div>
          </>
        ) : (
          <div aria-live="polite">
            {['queued', 'judging'].includes(latest.status) ? (
              <p className={styles.muted}>
                {latest.status === 'queued'
                  ? 'Đã nhận bài · Đang chờ chấm...'
                  : 'Đang biên dịch và chấm...'}
              </p>
            ) : latest.status === 'error' ? (
              <p className={styles.error}>{latest.error}</p>
            ) : (
              <p className={latest.passed === latest.total ? styles.success : styles.partial}>
                {latest.verdict} · {latest.passed}/{latest.total} test đúng
                {latest.mode === 'submit' ? ` · ${points(latest.points)}/100 điểm` : ''}
              </p>
            )}
            {latest.compileOutput && <pre>{latest.compileOutput}</pre>}
            {latest.results?.map((item, index) => (
              <div key={index}>
                <strong>
                  Ví dụ {index + 1}: {item.status}
                </strong>
                {item.output && <pre>{item.output}</pre>}
                {item.stderr && <pre>{item.stderr}</pre>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
export default function Contest({ data, seconds, busy, action, notice }) {
  const [selectedId, setSelectedId] = useState(data.problems[0]?.id);
  const languageKey = `coding-language:${data.me.userId}:${data.room.id}`;
  const [language, setLanguage] = useState(() => readLanguage(localStorage, languageKey));
  function changeLanguage(value) {
    setLanguage(value);
    try {
      localStorage.setItem(languageKey, value);
    } catch {
      notice('Không lưu được lựa chọn ngôn ngữ trên trình duyệt.');
    }
  }
  const problem = data.problems.find((p) => p.id === selectedId) || data.problems[0];
  const own = data.leaderboard.find((player) => player.userId === data.me.userId);
  if (!problem) return <p className={styles.error}>Không có đề trong cuộc thi này.</p>;
  return (
    <>
      <div className={styles.match_heading}>
        <div>
          <h1>{data.room.title}</h1>
          <p className={styles.muted}>
            Phòng {data.room.code} · {data.room.problemCount} đề · Một đồng hồ chung
          </p>
        </div>
        <strong className={styles.timer}>
          <FiClock />
          {data.judging ? 'Đang chấm bài đã nhận' : clock(seconds)}
        </strong>
      </div>
      <div className={styles.arena}>
        <aside className={`${styles.panel} ${styles.problem_sidebar}`}>
          <h2>Đề bài</h2>
          <div className={styles.problem_nav}>
            {data.problems.map((item) => {
              const score = own?.scores.find((score) => score.problemId === item.id);
              return (
                <button
                  key={item.id}
                  className={`${styles.problem_tab} ${problem.id === item.id ? styles.active_problem : ''}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className={styles.letter}>{item.letter}</span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {score?.solved ? '✓ ' : ''}
                      {points(score?.points)}/100 điểm
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
          <hr className={styles.divider} />
          <div className={styles.row} style={{ justifyContent: 'space-between' }}>
            <span className={styles.muted}>Tổng điểm</span>
            <strong>
              {points(own?.points)}/{data.room.maxPoints}
            </strong>
          </div>
          <div className={styles.progress}>
            <span style={{ width: `${((own?.points || 0) / data.room.maxPoints) * 100}%` }} />
          </div>
          <p className={styles.muted} style={{ fontSize: 11, marginTop: 14 }}>
            Mỗi đề giữ kết quả tốt nhất. Chuyển đề vẫn giữ bản nháp.
          </p>
        </aside>
        <section className={`${styles.panel} ${styles.problem_detail}`}>
          <ProblemDetails problem={problem} />
        </section>
        <ProblemEditor
          key={`${problem.id}:${language}`}
          language={language}
          onLanguageChange={changeLanguage}
          data={data}
          problem={problem}
          seconds={seconds}
          busy={busy}
          action={action}
          notice={notice}
        />
      </div>
    </>
  );
}
