import React from 'react';
import { Link } from 'react-router-dom';
import { useDocuments, date } from './api';
import styles from './documents.module.css';
export function Layout({ children }) {
  const catalog = useDocuments('/catalog');
  return (
    <main className={styles.page}>
      <nav className={styles.navigation} aria-label="Điều hướng kho tài liệu">
        <Link to="/documents">Kho tài liệu</Link>
        <Link to="/documents/new">Đăng tài liệu</Link>
        <Link to="/documents/mine">Tài liệu của tôi</Link>
        <Link to="/documents/saved">Đã lưu</Link>
        {catalog.data?.data.canModerate && <Link to="/documents/moderation">Quản lý báo cáo</Link>}
      </nav>
      {children}
    </main>
  );
}
export function State({ query, children }) {
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
export function Pager({ page, total, change }) {
  const pages = Math.max(1, Math.ceil(total / 20));
  return (
    <nav className={styles.bar} aria-label="Phân trang tài liệu">
      <button disabled={page <= 1} onClick={() => change(page - 1)}>
        Trang trước
      </button>
      <span>
        Trang {page} / {pages}
      </span>
      <button disabled={page >= pages} onClick={() => change(page + 1)}>
        Trang sau
      </button>
    </nav>
  );
}
export function Person({ author, time }) {
  return (
    <p className={styles.person}>
      {author ? (
        <Link to={'/profile/' + author.username}>
          {author.last_name} {author.first_name}
        </Link>
      ) : (
        'Tài khoản không còn khả dụng'
      )}{' '}
      · <time dateTime={time}>{date(time)}</time>
    </p>
  );
}
export function documentFiles(doc) {
  return [doc, ...(doc.additionalFiles || [])];
}
export function Card({ doc, catalog }) {
  const files = documentFiles(doc);
  const formats = [...new Set(files.map((file) => file.format.toUpperCase()))].join(', ');
  const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
  return (
    <article className={styles.card}>
      <h2>
        <Link to={'/documents/' + doc._id}>{doc.title}</Link>
      </h2>
      <p>
        {catalog?.subjects.find((s) => s.id === doc.subject)?.name} ·{' '}
        {catalog?.topics.find((t) => t.id === doc.topic)?.name}
      </p>
      <p>
        {files.length > 1 && files.length + ' tệp · '}
        {formats} · {(bytes / 1024 / 1024).toFixed(2)} MB · Hữu ích ({doc.helpfulCount})
      </p>
      {doc.status === 'hidden' && <p role="status">Đã ẩn: {doc.moderationReason}</p>}
      <div className={styles.bar}>
        {doc.keywords.map((word) => (
          <span key={word} className={styles.badge}>
            #{word}
          </span>
        ))}
      </div>
      <Person author={doc.author} time={doc.createdAt} />
    </article>
  );
}
export const validation = {
  onInvalid: (e) =>
    e.target.setCustomValidity('Vui lòng nhập đầy đủ thông tin trong giới hạn cho phép.'),
  onInput: (e) => e.target.setCustomValidity?.(''),
};
