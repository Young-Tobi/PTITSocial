import { useState } from 'react';
import { FiFileText, FiUpload, FiDownload, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import Modal from './Modal';
import { parseQuestionText, TEXT_SAMPLE } from '../importQuestions';
import { readQuestionFile, downloadQuestionTemplate } from '../excelImport';
import styles from '../quiz.module.css';
import { correctAnswers } from '../answers';

export default function QuestionImport({ mode, onClose, onImport, existingCount }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [time, setTime] = useState(20);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const excel = mode === 'excel';
  const badCount = preview?.filter((row) => row.errors.length).length || 0;
  const overLimit = preview && existingCount + preview.length > 100;
  async function inspect() {
    setError('');
    setBusy(true);
    try {
      if (excel && !file) throw Error('Chọn file .xlsx để xem trước.');
      setPreview(excel ? await readQuestionFile(file, time) : parseQuestionText(text, time));
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    setError('');
    try {
      await downloadQuestionTemplate();
    } catch {
      setError('Không tải được file mẫu. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }
  function confirm() {
    try {
      onImport(preview.map((row) => row.question));
    } catch (error) {
      setError(error.message);
    }
  }
  return (
    <Modal
      title={excel ? 'Nhập câu hỏi từ Excel' : 'Dán đề hàng loạt'}
      wide
      onClose={() => !busy && onClose()}
    >
      <p className={styles.muted}>
        Nhập tối đa 100 câu. Câu mới được thêm cuối bộ đề, không ghi đè câu đã soạn.
      </p>
      {!preview ? (
        <>
          {excel ? (
            <div className={styles.import_source}>
              <div className={styles.row_between}>
                <div>
                  <FiUpload /> <strong>Chọn file Excel</strong>
                </div>
                <button className={styles.outline} disabled={busy} onClick={download}>
                  <FiDownload /> Tải file mẫu
                </button>
              </div>
              <label className={styles.field}>
                File câu hỏi (.xlsx)
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={busy}
                  onChange={(event) => {
                    setFile(event.target.files[0] || null);
                    setError('');
                  }}
                />
              </label>
              <p className={styles.hint}>
                Tối đa 2 MB. Điền sheet “Cau hoi” trong file mẫu, giữ nguyên dòng tiêu đề. Các cột
                bắt buộc: Câu hỏi, A, B, C, D, Đáp án đúng. Thời gian và Giải thích có thể để trống.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.row_between}>
                <span className={styles.hint}>
                  <FiFileText /> Mỗi câu bắt đầu bằng “Câu 1:” hoặc “1.”
                </span>
                <button className={styles.text_button} onClick={() => setText(TEXT_SAMPLE)}>
                  Điền nội dung mẫu
                </button>
              </div>
              <label className={styles.field}>
                Nội dung đề
                <textarea
                  className={styles.import_text}
                  rows={13}
                  maxLength={200000}
                  placeholder={TEXT_SAMPLE}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                />
              </label>
              <p className={styles.hint}>
                Đáp án theo mẫu A. … B. … C. … D. …; ghi “Đáp án: B” hoặc “Đáp án: A, B” nếu có
                nhiều đáp án đúng. Có thể thêm “Giải thích: …” và “Thời gian: 30” cho từng câu. Nội
                dung câu hỏi, lựa chọn và giải thích có thể xuống dòng.
              </p>
            </>
          )}
          <label className={styles.field} htmlFor="import-default-time">
            Thời gian mặc định mỗi câu (giây)
          </label>
          <input
            id="import-default-time"
            type="number"
            min={5}
            max={180}
            step={1}
            value={time}
            onChange={(event) => setTime(event.target.value)}
            disabled={busy}
          />
          <p className={styles.hint}>
            Áp dụng khi câu hỏi không ghi thời gian riêng. Có thể sửa từng câu sau khi nhập.
          </p>
        </>
      ) : (
        <>
          <div className={styles.import_summary}>
            <FiCheckCircle /> <strong>Đọc được {preview.length} câu</strong>
            <span>{badCount ? `${badCount} câu cần sửa` : 'Tất cả câu đều hợp lệ'}</span>
            <span>Sau khi thêm: {existingCount + preview.length}/100 câu</span>
          </div>
          {badCount > 0 && (
            <p className={styles.error} role="alert">
              Có câu chưa hợp lệ. Quay lại sửa nội dung hoặc file Excel rồi xem trước lần nữa.
            </p>
          )}
          {overLimit && (
            <p className={styles.error} role="alert">
              Bộ đề đang có {existingCount} câu. Chỉ có thể thêm tối đa {100 - existingCount} câu.
            </p>
          )}
          <div className={styles.import_preview}>
            {preview.map((row, index) => (
              <article key={index} className={styles.import_item}>
                <div className={styles.row_between}>
                  <h3>
                    Câu {index + 1} · {row.source}
                  </h3>
                  <span className={styles.badge}>{row.question.timeLimit || '—'} giây</span>
                </div>
                <strong>{row.question.text || '(Thiếu nội dung)'}</strong>
                <div className={styles.import_options}>
                  {row.question.options.map((option, position) => (
                    <p
                      key={position}
                      className={
                        correctAnswers(row.question).includes(position) ? styles.success_text : ''
                      }
                    >
                      {'ABCD'[position]}. {option || '(Trống)'}{' '}
                      {correctAnswers(row.question).includes(position) && '✓'}
                    </p>
                  ))}
                </div>
                {row.question.explanation && (
                  <p className={styles.hint}>Giải thích: {row.question.explanation}</p>
                )}
                {row.errors.length > 0 && (
                  <ul className={styles.import_errors}>
                    {row.errors.map((issue, index) => (
                      <li key={index}>
                        <FiAlertCircle /> {issue}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.modal_actions}>
        {preview ? (
          <>
            <button
              className={styles.secondary}
              onClick={() => {
                setPreview(null);
                setError('');
              }}
            >
              Quay lại chỉnh sửa
            </button>
            <button
              className={styles.primary}
              disabled={!!badCount || !!overLimit}
              onClick={confirm}
            >
              Thêm {preview.length} câu vào bộ đề
            </button>
          </>
        ) : (
          <>
            <button className={styles.secondary} disabled={busy} onClick={onClose}>
              Hủy
            </button>
            <button
              className={styles.primary}
              disabled={busy || (excel ? !file : !text.trim())}
              onClick={inspect}
            >
              {busy ? 'Đang xử lý...' : 'Xem trước câu hỏi'}
            </button>
          </>
        )}
      </div>
      <p className={styles.hint}>
        Nhập câu hỏi chưa lưu bộ đề. Sau khi kiểm tra xong, bấm “Lưu nháp” hoặc “Lưu và sẵn sàng”
        trên trang soạn đề.
      </p>
    </Modal>
  );
}
