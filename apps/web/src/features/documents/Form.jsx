import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import { request, useDocuments, useAction } from './api';
import { Layout, State, validation } from './Common';
import styles from './documents.module.css';
function Fields({ doc }) {
  const catalog = useDocuments('/catalog');
  const navigate = useNavigate();
  const client = useQueryClient();
  const [uploads, setUploads] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const submitting = useRef(false);
  const action = useAction((result) => {
    toast.success('Đã cập nhật tài liệu.');
    navigate('/documents/' + result.data._id);
  });
  function chooseFiles(e) {
    const firstTitle = !uploads.length && new FormData(e.target.form).get('title');
    const selected = Array.from(e.target.files, (file, index) => {
      const stem = file.name.replace(/\.[^.]+$/, '');
      const title =
        index === 0 && firstTitle
          ? firstTitle
          : (stem.length >= 5 ? stem : file.name).slice(0, 200);
      const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
        n.toString(16).padStart(2, '0')
      ).join('');
      return { file, title, id };
    });
    setUploads(selected);
  }
  async function submit(e) {
    e.preventDefault();
    if (submitting.current) return;
    const element = e.currentTarget;
    const form = new FormData(element);
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
    if (!uploads.length) return toast.error('Chọn ít nhất một tệp để đăng.');
    const invalid = uploads.find(
      ({ file }) =>
        !file.size || file.size > 20 * 1024 * 1024 || !/\.(pdf|docx|pptx)$/i.test(file.name)
    );
    if (invalid)
      return toast.error(
        invalid.file.name + ': Chọn tệp PDF, DOCX hoặc PPTX, tối đa 20 MB mỗi tệp.'
      );
    const titles = form.getAll('title');
    form.delete('file');
    form.set('keywords', JSON.stringify(keywords));
    form.set('rightsConfirmed', 'true');
    submitting.current = true;
    setPublishing(true);
    const results = uploads.map((item) => ({ ...item }));
    try {
      for (const [i, item] of results.entries()) {
        if (item.documentId) continue;
        form.set('title', titles[i]);
        form.set('file', item.file);
        form.set('uploadId', item.id);
        try {
          const result = await request('', 'POST', form);
          item.documentId = result.data._id;
          item.error = '';
        } catch (error) {
          item.error = error.message;
        }
        setUploads(results.map((row) => ({ ...row })));
      }
      const published = results.filter((item) => item.documentId).length;
      if (published) await client.invalidateQueries({ queryKey: ['documents'] });
      if (!element.isConnected) return;
      if (published < results.length) {
        toast.error(`Đã đăng ${published}/${results.length} tài liệu. Kiểm tra các tệp còn lại.`);
        return;
      }
      toast.success(results.length === 1 ? 'Đã đăng tài liệu.' : `Đã đăng ${published} tài liệu.`);
      navigate(results.length === 1 ? '/documents/' + results[0].documentId : '/documents/mine');
    } finally {
      submitting.current = false;
      setPublishing(false);
    }
  }
  return (
    <State query={catalog}>
      <form className={styles.card} {...validation} onSubmit={submit}>
        <fieldset className={styles.fields} disabled={publishing || action.isLoading}>
          {!doc && (
            <label>
              Chọn một hoặc nhiều tệp tài liệu (PDF, DOCX, PPTX; tối đa 20 MB mỗi tệp)
              <input
                name="file"
                type="file"
                accept=".pdf,.docx,.pptx"
                multiple
                required
                onChange={chooseFiles}
              />
            </label>
          )}
          {(uploads.length ? uploads : [{ title: doc?.title || '' }]).map((item) => (
            <div key={item.id || 'title'}>
              <label>
                {uploads.length > 1 ? 'Tên tài liệu · ' + item.file.name : 'Tên tài liệu'}
                <input
                  name="title"
                  required
                  minLength={5}
                  maxLength={200}
                  defaultValue={item.title}
                  readOnly={!!item.documentId}
                />
              </label>
              {item.documentId && <span role="status">Đã đăng</span>}
              {item.error && <p role="alert">{item.error}</p>}
            </div>
          ))}
          {uploads.length > 1 && (
            <p>Mô tả, môn học, chủ đề, từ khóa và nguồn bên dưới áp dụng cho tất cả tệp đã chọn.</p>
          )}
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
            <div className={styles.checks}>
              <label>
                <input name="rightsConfirmed" type="checkbox" required />
                Tôi có quyền chia sẻ các tệp đã chọn và chịu trách nhiệm về nội dung đã đăng.
              </label>
            </div>
          ) : (
            <p>Tệp hiện tại: {doc.originalName}. Muốn đổi tệp, hãy đăng tài liệu mới.</p>
          )}
          {uploads.some((item) => item.error) && (
            <p>Đăng lại để gửi các tệp còn lỗi. Chọn tệp khác để bắt đầu lượt đăng mới.</p>
          )}
          <button className={styles.primary}>
            {publishing || action.isLoading ? 'Đang lưu…' : doc ? 'Lưu thay đổi' : 'Đăng tài liệu'}
          </button>
        </fieldset>
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
