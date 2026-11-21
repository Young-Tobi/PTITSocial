import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import { base, useDocuments, useAction } from './api';
import { Layout, State, Person, Pager, documentFiles, validation } from './Common';
import styles from './documents.module.css';
function Comments({ id, user, published }) {
  const [page, setPage] = useState(1),
    [body, setBody] = useState('');
  const query = useDocuments('/' + id + '/comments?page=' + page);
  const action = useAction(() => {
    setBody('');
    toast.success('Đã cập nhật nhận xét.');
  });
  return (
    <section className={styles.card}>
      <h2>Nhận xét ({query.data?.total || 0})</h2>
      <State query={query}>
        {query.data?.data.map((item) => (
          <article className={styles.comment} key={item._id}>
            <Person author={item.author} time={item.createdAt} />
            <p>{item.body}</p>
            {item.author?._id === user && (
              <button
                disabled={action.isLoading}
                onClick={() => action.mutate({ path: '/comments/' + item._id, method: 'DELETE' })}
              >
                Xóa nhận xét
              </button>
            )}
          </article>
        ))}
        {!query.data?.total && <p>Chưa có nhận xét.</p>}
        <Pager page={page} total={query.data?.total || 0} change={setPage} />
      </State>
      {published && (
        <form
          {...validation}
          onSubmit={(e) => {
            e.preventDefault();
            action.mutate({ path: '/' + id + '/comments', data: { body } });
          }}
        >
          <label>
            Nhận xét
            <textarea
              required
              maxLength={1000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <button disabled={action.isLoading}>Gửi nhận xét</button>
        </form>
      )}
    </section>
  );
}
function Report({ id, catalog }) {
  const [open, setOpen] = useState(false);
  const action = useAction(() => {
    setOpen(false);
    toast.success('Đã gửi báo cáo.');
  });
  return (
    <>
      <button type="button" onClick={() => setOpen(!open)}>
        Báo cáo tài liệu
      </button>
      {open && (
        <form
          className={styles.card}
          {...validation}
          onSubmit={(e) => {
            e.preventDefault();
            action.mutate({
              path: '/' + id + '/reports',
              data: Object.fromEntries(new FormData(e.currentTarget)),
            });
          }}
        >
          <label>
            Lý do báo cáo
            <select aria-label="Lý do báo cáo" required name="reason">
              <option value="">Chọn lý do</option>
              {catalog?.reasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mô tả báo cáo
            <textarea name="body" required minLength={5} maxLength={1000} />
          </label>
          <button disabled={action.isLoading}>Gửi báo cáo</button>
        </form>
      )}
    </>
  );
}
function Attachments({ doc }) {
  const [preview, setPreview] = useState(null);
  const files = documentFiles(doc);
  return files.map((file, index) => {
    const prefix = base + '/' + doc._id;
    const query = index === 0 ? '' : '?file=' + index;
    return (
      <section key={index} aria-label={file.originalName}>
        <p>
          {file.originalName} · {file.format.toUpperCase()} ·{' '}
          {(file.bytes / 1024 / 1024).toFixed(2)} MB
        </p>
        {doc.status === 'published' && (
          <>
            <div className={styles.bar}>
              <a href={prefix + '/download' + query}>Tải tài liệu xuống</a>
              {file.format === 'pdf' ? (
                <button onClick={() => setPreview(preview === index ? null : index)}>
                  {preview === index ? 'Đóng xem trước' : 'Xem trước PDF'}
                </button>
              ) : (
                <span>Định dạng này chưa hỗ trợ xem trước.</span>
              )}
            </div>
            {preview === index && (
              <iframe
                title="Xem trước tài liệu PDF"
                src={prefix + '/preview' + query}
                style={{ width: '100%', height: 600, border: 0 }}
              />
            )}
          </>
        )}
      </section>
    );
  });
}
export default function Detail() {
  const { id } = useParams();
  const query = useDocuments('/' + id),
    catalog = useDocuments('/catalog');
  const user = useSelector((s) => s.user.userinfo?._id),
    navigate = useNavigate();
  const action = useAction();
  const remove = useAction(() => {
    toast.success('Đã xóa tài liệu.');
    navigate('/documents/mine');
  });
  const doc = query.data?.data;
  return (
    <Layout>
      <State query={query}>
        {doc && (
          <>
            <article className={styles.card}>
              <h1>{doc.title}</h1>
              <Person author={doc.author} time={doc.createdAt} />
              <p>
                {catalog.data?.data.subjects.find((s) => s.id === doc.subject)?.name} ·{' '}
                {catalog.data?.data.topics.find((s) => s.id === doc.topic)?.name}
              </p>
              <div className={styles.body}>{doc.description}</div>
              <p>Nguồn/tác giả: {doc.source || 'Người đăng chưa cung cấp'}</p>
              <Attachments key={doc._id} doc={doc} />
              <div className={styles.bar}>
                {doc.keywords.map((k) => (
                  <span className={styles.badge} key={k}>
                    #{k}
                  </span>
                ))}
              </div>
              {doc.status === 'hidden' ? (
                <p role="status">Tài liệu đã bị ẩn: {doc.moderationReason}</p>
              ) : (
                <>
                  <div className={styles.bar}>
                    <button
                      aria-pressed={doc.isFavorite}
                      disabled={action.isLoading}
                      onClick={() =>
                        action.mutate({
                          path: '/' + id + '/favorite',
                          method: doc.isFavorite ? 'DELETE' : 'PUT',
                        })
                      }
                    >
                      {doc.isFavorite ? 'Bỏ lưu' : 'Lưu yêu thích'}
                    </button>
                    <button
                      aria-pressed={doc.isHelpful}
                      disabled={action.isLoading || doc.author?._id === user}
                      onClick={() =>
                        action.mutate({
                          path: '/' + id + '/helpful',
                          method: doc.isHelpful ? 'DELETE' : 'PUT',
                        })
                      }
                    >
                      Hữu ích ({doc.helpfulCount})
                    </button>
                  </div>
                  <Report id={id} catalog={catalog.data?.data} />
                </>
              )}
              {doc.author?._id === user && (
                <div className={styles.bar}>
                  <Link to={'/documents/' + id + '/edit'}>Sửa thông tin</Link>
                  <button
                    disabled={remove.isLoading}
                    onClick={() => {
                      if (window.confirm('Xóa tài liệu này? Thao tác sẽ gỡ tài liệu khỏi kho.'))
                        remove.mutate({ path: '/' + id, method: 'DELETE' });
                    }}
                  >
                    Xóa tài liệu
                  </button>
                </div>
              )}
            </article>
            <Comments key={id} id={id} user={user} published={doc.status === 'published'} />
          </>
        )}
      </State>
    </Layout>
  );
}
