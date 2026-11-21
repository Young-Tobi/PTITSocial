import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import { request, useDocuments, useAction } from './api';
import { Layout, State, documentFiles, validation } from './Common';
import styles from './documents.module.css';
function Fields({ doc }) {
  const catalog = useDocuments('/catalog');
  const navigate = useNavigate();
  const client = useQueryClient();
  const [files, setFiles] = useState([]);
  const uploadId = useRef();
  const [formError, setFormError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const submitting = useRef(false);
  const action = useAction((result) => {
    toast.success('Đã cập nhật tài liệu.');
    navigate('/documents/' + result.data._id);
  });
  function chooseFiles(e) {
    const selected = Array.from(e.target.files);
    const title = e.target.form.elements.title;
    if (!title.value && selected.length) {
      const name = selected[0].name.replace(/\.[^.]+$/, '');
      title.value = (name.length >= 5 ? name : selected[0].name).slice(0, 200);
    }
    uploadId.current = Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
      n.toString(16).padStart(2, '0')
    ).join('');
    setFiles(selected);
    setFormError('');
  }
  async function submit(e) {
    e.preventDefault();
    if (submitting.current) return;
    setFormError('');
    const element = e.currentTarget;
    const form = new FormData(element);
    const keywords = form
      .get('keywords')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (keywords.length > 5) return setFormError('Chọn tối đa 5 từ khóa.');
    if (doc) {
      action.mutate({
        path: '/' + doc._id,
        method: 'PATCH',
        data: { ...Object.fromEntries(form), keywords },
      });
      return;
    }
    if (!files.length) return setFormError('Chọn ít nhất một tệp để đăng.');
    if (files.length > catalog.data.data.maxFiles)
      return setFormError(`Mỗi bài được tối đa ${catalog.data.data.maxFiles} tệp.`);
    const invalid = files.find(
      (file) => !file.size || file.size > 20 * 1024 * 1024 || !/\.(pdf|docx|pptx)$/i.test(file.name)
    );
    if (invalid)
      return setFormError(invalid.name + ': Chọn tệp PDF, DOCX hoặc PPTX, tối đa 20 MB mỗi tệp.');
    form.set('keywords', JSON.stringify(keywords));
    form.set('rightsConfirmed', 'true');
    form.set('uploadId', uploadId.current);
    submitting.current = true;
    setPublishing(true);
    try {
      const result = await request('', 'POST', form);
      await client.invalidateQueries({ queryKey: ['documents'] });
      if (element.isConnected) {
        toast.success('Đã đăng tài liệu.');
        navigate('/documents/' + result.data._id);
      }
    } catch (error) {
      setFormError(error.message);
    } finally {
      submitting.current = false;
      setPublishing(false);
    }
  }
  return (
    <State query={catalog}>
      <form className={styles.card} {...validation} onSubmit={submit}>
        <fieldset className={styles.fields} disabled={publishing || action.isLoading}>
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
          {!doc && (
            <label>
              Tệp đính kèm (PDF, DOCX, PPTX; tối đa 20 MB mỗi tệp, {catalog.data?.data.maxFiles} tệp
              mỗi bài)
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
          {files.length > 0 && (
            <div>
              <p>{files.length} tệp đính kèm trong bài đăng này</p>
              <ul>
                {files.map((file, index) => (
                  <li key={index}>{file.name}</li>
                ))}
              </ul>
            </div>
          )}
          {!doc ? (
            <div className={styles.checks}>
              <label>
                <input name="rightsConfirmed" type="checkbox" required />
                Tôi có quyền chia sẻ các tệp đã chọn và chịu trách nhiệm về nội dung đã đăng.
              </label>
            </div>
          ) : (
            <p>
              Tệp hiện tại:{' '}
              {documentFiles(doc)
                .map((file) => file.originalName)
                .join(', ')}
              . Muốn đổi tệp, hãy đăng tài liệu mới.
            </p>
          )}
          {formError && <p role="alert">{formError}</p>}
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
