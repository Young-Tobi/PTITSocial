import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { studyApi, errorMessage } from 'features/study/api';
import styles from './focus.module.css';

const themes = [
  ['night-library', 'Thư viện ban đêm'],
  ['coffee-shop', 'Quán cà phê'],
  ['rain-window', 'Mưa bên cửa sổ'],
  ['green-nature', 'Không gian thiên nhiên'],
];
export default function FocusCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    description: '',
    topic: '',
    privacy: 'public',
    maxMembers: 8,
    theme: 'night-library',
    password: '',
    allowMicrophones: true,
  });
  const [saving, setSaving] = useState(false);
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await studyApi.post('/focus-rooms', form);
      navigate(`/focus/${data.data.room._id}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <main className={styles.formPage}>
      <form className={styles.createCard} onSubmit={submit}>
        <span className={styles.eyebrow}>TẠO KHÔNG GIAN MỚI</span>
        <h1>Phòng học của bạn</h1>
        <p>Thiết lập một góc học tập vừa đủ riêng tư, nhẹ nhàng và có mục tiêu.</p>
        <label>
          Tên phòng
          <input
            required
            minLength="3"
            maxLength="80"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Ví dụ: Ôn thi cuối kỳ cùng nhau"
          />
        </label>
        <div className={styles.formRow}>
          <label>
            Chủ đề
            <input
              maxLength="80"
              value={form.topic}
              onChange={(e) => update('topic', e.target.value)}
              placeholder="Lập trình Web"
            />
          </label>
          <label>
            Số thành viên
            <select
              value={form.maxMembers}
              onChange={(e) => update('maxMembers', Number(e.target.value))}
            >
              {[2, 4, 6, 8, 10, 12, 16, 20].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Mô tả
          <textarea
            maxLength="500"
            rows="3"
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Mục tiêu và không khí của phòng..."
          />
        </label>
        <fieldset>
          <legend>Quyền riêng tư</legend>
          <div className={styles.choiceRow}>
            {['public', 'private'].map((item) => (
              <button
                type="button"
                key={item}
                className={form.privacy === item ? styles.selected : ''}
                onClick={() => update('privacy', item)}
              >
                {item === 'public' ? '🌐 Công khai' : '🔒 Riêng tư'}
              </button>
            ))}
          </div>
          {form.privacy === 'private' && (
            <label className={styles.privatePassword}>
              Mật khẩu vào phòng
              <input
                required
                minLength="4"
                maxLength="64"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => update('password', event.target.value)}
                placeholder="Tối thiểu 4 ký tự"
              />
              <small>Người tham gia cần cả link mời và mật khẩu này.</small>
            </label>
          )}
        </fieldset>
        <fieldset>
          <legend>Quyền sử dụng micro</legend>
          <div className={styles.choiceRow}>
            <button
              type="button"
              className={form.allowMicrophones ? styles.selected : ''}
              onClick={() => update('allowMicrophones', true)}
            >
              Cho phép thành viên bật mic
            </button>
            <button
              type="button"
              className={!form.allowMicrophones ? styles.selected : ''}
              onClick={() => update('allowMicrophones', false)}
            >
              Khóa mic toàn phòng
            </button>
          </div>
          <small className={styles.fieldHint}>
            Chủ phòng luôn có thể thay đổi thiết lập này và tắt mic từng thành viên trong phòng.
          </small>
        </fieldset>
        <fieldset>
          <legend>Không gian</legend>
          <div className={styles.themeChoices}>
            {themes.map(([id, label]) => (
              <button
                type="button"
                key={id}
                className={`${styles.themeChoice} ${styles[id]} ${form.theme === id ? styles.selectedTheme : ''}`}
                onClick={() => update('theme', id)}
              >
                <span>{label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className={styles.formActions}>
          <button type="button" onClick={() => navigate('/focus')}>
            Hủy
          </button>
          <button className={styles.primaryButton} disabled={saving}>
            {saving ? 'Đang tạo…' : 'Tạo và vào phòng'}
          </button>
        </div>
      </form>
    </main>
  );
}
