import React from 'react';
import { Link } from 'react-router-dom';
import { dateTime } from './api';
import styles from './academic.module.css';
export function Layout({ children }) {
  return (
    <main className={styles.page}>
      <nav className={styles.navigation} aria-label="Điều hướng hỏi đáp">
        <Link to="/questions">Hỏi đáp học thuật</Link>
        <Link to="/questions/new">Đặt câu hỏi</Link>
        <Link to="/questions/interests">Lĩnh vực quan tâm</Link>
      </nav>
      {children}
    </main>
  );
}
export function QueryState({ query, children }) {
  if (query.isLoading) return <p role="status">Đang tải…</p>;
  if (query.isError)
    return (
      <div role="alert">
        <p>{query.error.message}</p>
        <button onClick={() => query.refetch()}>Thử lại</button>
      </div>
    );
  return children;
}
export function TextContent({ children }) {
  return <div className={styles.body}>{children || ''}</div>;
}
export function Editor({ value, onChange, label = 'Nội dung', minLength = 10 }) {
  return (
    <label>
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={minLength}
        maxLength={20000}
        rows={10}
        spellCheck={false}
        placeholder="Nhập nội dung rõ ràng, đầy đủ."
      />
    </label>
  );
}
export function Person({ author, createdAt }) {
  return (
    <div className={styles.person}>
      {author?.photo && <img src={author.photo} alt="" />}
      {author ? (
        <Link to={'/profile/' + author.username}>
          {author.last_name} {author.first_name}
        </Link>
      ) : (
        <span>Tài khoản không còn khả dụng</span>
      )}
      <time dateTime={createdAt}>{dateTime(createdAt)}</time>
    </div>
  );
}
export function Pager({ page, total, limit = 20, onChange }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <nav className={styles.bar} aria-label="Phân trang">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Trang trước
      </button>
      <span>
        Trang {page} / {pages}
      </span>
      <button disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Trang sau
      </button>
    </nav>
  );
}
export function QuestionCard({ question, subjects = [] }) {
  return (
    <article className={styles.card}>
      <span className={question.resolved ? styles.resolved : styles.badge}>
        {question.resolved ? 'Đã giải quyết' : 'Chưa giải quyết'}
      </span>
      <h3>
        <Link to={'/questions/' + question._id}>{question.title}</Link>
      </h3>
      <p>
        {subjects.find((s) => s.id === question.subject)?.name} · {question.answerCount} câu trả lời
      </p>
      <div className={styles.bar}>
        {question.tags.map((tag) => (
          <span className={styles.badge} key={tag}>
            #{tag}
          </span>
        ))}
      </div>
      <Person author={question.author} createdAt={question.createdAt} />
    </article>
  );
}
export const formValidation = {
  onInvalid: (e) =>
    e.target.setCustomValidity('Vui lòng nhập đầy đủ nội dung trong giới hạn cho phép.'),
  onInput: (e) => e.target.setCustomValidity?.(''),
};
