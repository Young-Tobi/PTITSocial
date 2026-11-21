import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAcademic, useAcademicMutation, splitTags } from 'features/academic/api';
import { Layout, Editor, QueryState, formValidation } from 'features/academic/Common';
import styles from 'features/academic/academic.module.css';
export default function NewQuestion() {
  const navigate = useNavigate();
  const subjects = useAcademic('/academic/subjects');
  const [body, setBody] = useState('');
  const mutation = useAcademicMutation((result) => {
    toast.success('Đã đăng câu hỏi.');
    navigate('/questions/' + result.data._id);
  });
  function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    mutation.mutate({
      path: '/academic/questions',
      data: {
        title: form.get('title'),
        body,
        subject: form.get('subject'),
        tags: splitTags(form.get('tags')),
      },
    });
  }
  return (
    <Layout>
      <h1>Đặt câu hỏi</h1>
      <QueryState query={subjects}>
        <form className={styles.card} onSubmit={submit} {...formValidation}>
          <label>
            Tiêu đề
            <input
              name="title"
              required
              minLength={10}
              maxLength={200}
              placeholder="Ví dụ: Không kết nối được MongoDB từ Node.js"
            />
          </label>
          <label>
            Môn học
            <select aria-label="Môn học" name="subject" required defaultValue="">
              <option value="">Chọn môn học</option>
              {subjects.data?.data.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Thẻ chủ đề
            <input name="tags" placeholder="Tối đa 5 thẻ, cách nhau bằng dấu phẩy" />
          </label>
          <Editor
            value={body}
            onChange={setBody}
            minLength={20}
            label="Mô tả vấn đề (20–20.000 ký tự)"
          />
          <button className={styles.primary} disabled={mutation.isLoading}>
            {mutation.isLoading ? 'Đang đăng…' : 'Đăng câu hỏi'}
          </button>
        </form>
      </QueryState>
    </Layout>
  );
}
