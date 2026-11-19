import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import { useDocuments, useAction } from './api';
import { Layout, State, validation } from './Common';
import styles from './documents.module.css';
function Fields({ doc }) {
  const catalog = useDocuments('/catalog');
  const navigate = useNavigate();
  const action = useAction((result) => {
    toast.success(doc ? 'Đã cập nhật tài liệu.' : 'Đã đăng tài liệu.');
    navigate('/documents/' + result.data._id);
  });
  function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const keywords = form
      .get('keywords')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (keywords.length > 5) return toast.error('Chọn tối đa 5 từ khóa.');
    if (doc) {
      action.mutate({
        path: '/' + doc._id,
        method: 'PATCH',
        data: { ...Object.fromEntries(form), keywords },
      });
      return;
    }
    const file = form.get('file');
    if (!file.size || file.size > 20 * 1024 * 1024 || !/\.(pdf|docx|pptx)$/i.test(file.name))
      return toast.error('Chọn một tệp PDF, DOCX hoặc PPTX, tối đa 20 MB.');
    form.set('keywords', JSON.stringify(keywords));
    form.set('rightsConfirmed', 'true');
    action.mutate({ path: '', data: form });
  }
  return (
    <State query={catalog}>
      <form className={styles.card} {...validation} onSubmit={submit}>
        <label>
          Tên tài liệu
          <input
            name="title"
            required
            minLength={5}
            maxLength={200}
            defaultValue={doc?.title || ''}
          />
        </label>
        <label>
          Mô tả
          <textarea
            name="description"
            required
            minLength={20}
            maxLength={5000}
            rows={6}
            defaultValue={doc?.description || ''}
          />
        </label>
        <label>
          Môn học
          <select aria-label="Môn học" required name="subject" defaultValue={doc?.subject || ''}>
            <option value="">Chọn môn học</option>
            {catalog.data?.data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Chủ đề
          <select aria-label="Chủ đề" required name="topic" defaultValue={doc?.topic || ''}>
            <option value="">Chọn chủ đề</option>
            {catalog.data?.data.topics.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Từ khóa
          <input
            name="keywords"
            maxLength={160}
            placeholder="Tối đa 5 từ khóa, cách nhau bằng dấu phẩy"
            defaultValue={doc?.keywords.join(', ') || ''}
          />
        </label>
        <label>
          Nguồn/tác giả
          <input name="source" maxLength={1000} defaultValue={doc?.source || ''} />
        </label>
        {!doc ? (
          <>
            <label>
              Tệp tài liệu (PDF, DOCX, PPTX; tối đa 20 MB)
              <input name="file" type="file" accept=".pdf,.docx,.pptx" required />
            </label>
            <div className={styles.checks}>
              <label>
                <input name="rightsConfirmed" type="checkbox" required />
                Tôi có quyền chia sẻ tài liệu này và chịu trách nhiệm về nội dung đã đăng.
              </label>
            </div>
          </>
        ) : (
          <p>Tệp hiện tại: {doc.originalName}. Muốn đổi tệp, hãy đăng tài liệu mới.</p>
        )}
        <button className={styles.primary} disabled={action.isLoading}>
          {action.isLoading ? 'Đang lưu…' : doc ? 'Lưu thay đổi' : 'Đăng tài liệu'}
        </button>
      </form>
    </State>
  );
}
export function NewDocument() {
  return (
    <Layout>
      <h1>Đăng tài liệu</h1>
      <Fields />
    </Layout>
  );
}
export function EditDocument() {
  const { id } = useParams();
  const query = useDocuments('/' + id);
  const user = useSelector((s) => s.user.userinfo?._id);
  return (
    <Layout>
      <h1>Sửa thông tin tài liệu</h1>
      <State query={query}>
        {query.data &&
          (query.data.data.author?._id === user ? (
            <Fields key={id} doc={query.data.data} />
          ) : (
            <p role="alert">Bạn chỉ được sửa tài liệu do mình đăng.</p>
          ))}
      </State>
    </Layout>
  );
}
