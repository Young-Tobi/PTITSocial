import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { FiPlus, FiGlobe, FiLock } from 'react-icons/fi';
import Modal from 'features/quiz/components/Modal';
import { codingRequest, errorMessage } from 'features/coding/api';
import { Tag, ProblemDetails } from 'features/coding/components';
import styles from 'features/coding/contest.module.css';
import { supportedLanguages } from 'features/coding/languages';
export default function CreateCodingRoom() {
  const user = useSelector((state) => state.user.userinfo),
    navigate = useNavigate(),
    [params] = useSearchParams(),
    from = params.get('from');
  const catalog = useQuery({
    queryKey: ['coding-problems'],
    queryFn: () => codingRequest('GET', '/problems'),
  });
  const template = useQuery({
    queryKey: ['coding-template', from],
    queryFn: () => codingRequest('GET', '/rooms/' + from),
    enabled: !!from,
    retry: false,
  });
  const [form, setForm] = useState({
    title: 'Phòng của ' + user?.first_name,
    durationMinutes: 45,
    maxPlayers: 8,
    visibility: 'public',
    problemIds: [],
  });
  const [search, setSearch] = useState(''),
    [difficulty, setDifficulty] = useState('all'),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [loadedFrom, setLoadedFrom] = useState(null);
  useEffect(() => {
    if (template.data && loadedFrom !== from) {
      const { room, problems } = template.data;
      setForm({
        title: room.title,
        durationMinutes: room.durationMinutes,
        maxPlayers: room.maxPlayers,
        visibility: room.visibility,
        problemIds: problems.map((p) => p.id),
      });
      setLoadedFrom(from);
    }
  }, [template.data, from, loadedFrom]);
  const all = catalog.data?.problems || [],
    selected = form.problemIds.map((id) => all.find((p) => p.id === id)).filter(Boolean),
    available = all.filter(
      (p) =>
        p.title.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')) &&
        (difficulty === 'all' || p.difficulty === difficulty)
    );
  function choose(id) {
    setForm((current) => ({
      ...current,
      problemIds: current.problemIds.includes(id)
        ? current.problemIds.filter((value) => value !== id)
        : [...current.problemIds, id],
    }));
  }
  function move(id, direction) {
    const ids = [...form.problemIds],
      i = ids.indexOf(id),
      next = i + direction;
    if (next < 0 || next >= ids.length) return;
    [ids[i], ids[next]] = [ids[next], ids[i]];
    setForm({ ...form, problemIds: ids });
  }
  async function create(event) {
    event.preventDefault();
    if (!form.problemIds.length) {
      setError('Bạn cần chọn ít nhất một đề.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await codingRequest('POST', '/rooms', form);
      navigate('/coding/rooms/' + data.room.id);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <main className={styles.workspace}>
        <div className={styles.breadcrumbs}>
          <Link to="/coding">Thi đấu lập trình</Link>
          <span>/</span>Tạo phòng
        </div>
        <div className={styles.heading}>
          <div>
            <h1>Tạo phòng thi đấu</h1>
            <p>Bạn là người tổ chức, lựa chọn bộ đề và điều hành cuộc thi.</p>
          </div>
        </div>
        {template.isError && <p className={styles.error}>{errorMessage(template.error)}</p>}
        <form onSubmit={create}>
          <fieldset disabled={busy || (!!from && template.isLoading)}>
            <div className={styles.two_col}>
              <div className={styles.stack}>
                <section className={styles.panel}>
                  <div className={styles.section_title}>
                    <span className={styles.step}>1</span>
                    <h2>Thông tin phòng</h2>
                  </div>
                  <div className={styles.fields}>
                    <label className={styles.full}>
                      Tên phòng
                      <input
                        required
                        maxLength={100}
                        value={form.title}
                        onChange={(event) => setForm({ ...form, title: event.target.value })}
                      />
                    </label>
                    <label>
                      Số người thi tối đa
                      <input
                        required
                        type="number"
                        min={2}
                        max={30}
                        value={form.maxPlayers}
                        onChange={(event) =>
                          setForm({ ...form, maxPlayers: Number(event.target.value) })
                        }
                      />
                    </label>
                    <label>
                      Thời lượng (phút)
                      <input
                        required
                        type="number"
                        min={5}
                        max={180}
                        value={form.durationMinutes}
                        onChange={(event) =>
                          setForm({ ...form, durationMinutes: Number(event.target.value) })
                        }
                      />
                    </label>
                    <div className={styles.full}>
                      <h3>Quyền truy cập</h3>
                      <div className={styles.visibility}>
                        {[
                          ['public', 'Công khai', 'Hiển thị trong danh sách phòng.', FiGlobe],
                          ['private', 'Riêng tư', 'Tham gia bằng mã phòng.', FiLock],
                        ].map(([value, label, note, Icon]) => (
                          <label
                            className={`${styles.choice} ${form.visibility === value ? styles.chosen : ''}`}
                            key={value}
                          >
                            <input
                              type="radio"
                              name="visibility"
                              value={value}
                              checked={form.visibility === value}
                              onChange={() => setForm({ ...form, visibility: value })}
                            />
                            <span>
                              <strong>
                                <Icon />
                                {label}
                              </strong>
                              <small>{note}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className={styles.muted}>
                    Số chỗ chỉ tính người thi, không tính người tổ chức.
                  </p>
                </section>
                <section className={styles.panel}>
                  <div className={styles.section_title}>
                    <span className={styles.step}>2</span>
                    <h2>Chọn đề từ kho</h2>
                    <Tag tone="rose">{form.problemIds.length} đề đã chọn</Tag>
                  </div>
                  <div className={styles.toolbar}>
                    <input
                      aria-label="Tìm đề"
                      placeholder="Tìm tên đề..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    <select
                      aria-label="Độ khó"
                      value={difficulty}
                      onChange={(event) => setDifficulty(event.target.value)}
                    >
                      <option value="all">Tất cả độ khó</option>
                      <option value="easy">Cơ bản</option>
                      <option value="medium">Trung bình</option>
                    </select>
                  </div>
                  {catalog.isLoading ? (
                    <p className={styles.muted}>Đang tải kho đề...</p>
                  ) : catalog.isError ? (
                    <p className={styles.error}>{errorMessage(catalog.error)}</p>
                  ) : (
                    available.map((problem) => (
                      <div className={styles.problem_pick} key={problem.id}>
                        <input
                          id={'coding-pick-' + problem.id}
                          type="checkbox"
                          checked={form.problemIds.includes(problem.id)}
                          onChange={() => choose(problem.id)}
                        />
                        <label htmlFor={'coding-pick-' + problem.id}>
                          {problem.title}
                          <small>
                            <Tag tone={problem.difficulty === 'easy' ? 'green' : 'orange'}>
                              {problem.difficulty === 'easy' ? 'Cơ bản' : 'Trung bình'}
                            </Tag>{' '}
                            <span className={styles.muted}>100 điểm</span>
                          </small>
                        </label>
                        <button
                          type="button"
                          className={styles.text_button}
                          onClick={() => setPreview(problem)}
                        >
                          Xem đề
                        </button>
                      </div>
                    ))
                  )}
                  {!catalog.isLoading && !available.length && (
                    <p className={styles.muted}>Không có đề phù hợp.</p>
                  )}
                  <p className={styles.muted}>
                    Chọn ít nhất 1 đề. Một đồng hồ chung cho toàn bộ cuộc thi.
                  </p>
                </section>
              </div>
              <aside className={`${styles.panel} ${styles.summary}`}>
                <h2>Bộ đề của phòng</h2>
                <p className={styles.muted}>
                  Thứ tự dưới đây cũng là thứ tự hiển thị cho người thi.
                </p>
                {selected.map((problem, index) => (
                  <div className={styles.selected_problem} key={problem.id}>
                    <span className={styles.letter}>{String.fromCharCode(65 + index)}</span>
                    <strong>{problem.title}</strong>
                    <button
                      type="button"
                      className={styles.tiny}
                      disabled={index === 0}
                      onClick={() => move(problem.id, -1)}
                      aria-label={'Đưa ' + problem.title + ' lên'}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={styles.tiny}
                      disabled={index === selected.length - 1}
                      onClick={() => move(problem.id, 1)}
                      aria-label={'Đưa ' + problem.title + ' xuống'}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={styles.tiny}
                      onClick={() => choose(problem.id)}
                      aria-label={'Bỏ ' + problem.title}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {!selected.length && <p className={styles.muted}>Chưa chọn đề nào.</p>}
                <dl className={styles.settings}>
                  <dt>Ngôn ngữ</dt>
                  <dd>{supportedLanguages}</dd>
                  <dt>Điểm mỗi đề</dt>
                  <dd>100 điểm</dd>
                  <dt>Thời lượng</dt>
                  <dd>{form.durationMinutes} phút</dd>
                  <dt>Số người tối đa</dt>
                  <dd>{form.maxPlayers} người</dd>
                </dl>
                <div className={styles.total}>
                  <span>Tổng điểm tối đa</span>
                  <b>{selected.length * 100}</b>
                </div>
                {error && (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                )}
                <button
                  className={`${styles.primary} ${styles.wide}`}
                  disabled={busy || catalog.isLoading || catalog.isError}
                >
                  <FiPlus />
                  {busy ? 'Đang tạo phòng...' : 'Tạo phòng'}
                </button>
                <div className={styles.note} style={{ marginTop: 20 }}>
                  Đề chỉ hiển thị cho người thi khi cuộc thi bắt đầu. Bạn có thể xem trước đề trong
                  lúc chuẩn bị.
                </div>
              </aside>
            </div>
          </fieldset>
        </form>
        {preview && (
          <Modal title={preview.title} onClose={() => setPreview(null)}>
            <ProblemDetails problem={preview} />
          </Modal>
        )}
      </main>
    </>
  );
}
