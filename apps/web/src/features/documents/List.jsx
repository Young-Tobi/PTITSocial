import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDocuments } from './api';
import { Layout, State, Card, Pager } from './Common';
import styles from './documents.module.css';
export default function List({ scope = '' }) {
  const [params, setParams] = useSearchParams();
  const catalog = useDocuments('/catalog');
  const query = useDocuments(scope + '?' + params.toString());
  function search(e) {
    e.preventDefault();
    const next = new URLSearchParams();
    for (const [key, value] of new FormData(e.currentTarget))
      if (value.trim()) next.set(key, value.trim());
    setParams(next);
  }
  return (
    <Layout>
      <h1>
        {scope === '/mine'
          ? 'Tài liệu của tôi'
          : scope === '/saved'
            ? 'Tài liệu đã lưu'
            : 'Kho tài liệu học tập cộng đồng'}
      </h1>
      <State query={catalog}>
        <form className={styles.card} key={scope + params.toString()} onSubmit={search}>
          <label>
            Tìm kiếm
            <input
              name="q"
              maxLength={200}
              defaultValue={params.get('q') || ''}
              placeholder="Tên, mô tả hoặc từ khóa"
            />
          </label>
          <div className={styles.filters}>
            <label>
              Môn học
              <select
                aria-label="Môn học"
                name="subject"
                defaultValue={params.get('subject') || ''}
              >
                <option value="">Tất cả môn học</option>
                {catalog.data?.data.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Chủ đề
              <select aria-label="Chủ đề" name="topic" defaultValue={params.get('topic') || ''}>
                <option value="">Tất cả chủ đề</option>
                {catalog.data?.data.topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Định dạng
              <select
                aria-label="Định dạng"
                name="format"
                defaultValue={params.get('format') || ''}
              >
                <option value="">Tất cả định dạng</option>
                {['pdf', 'docx', 'pptx'].map((f) => (
                  <option key={f} value={f}>
                    {f.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Từ ngày
              <input type="date" name="from" defaultValue={params.get('from') || ''} />
            </label>
            <label>
              Đến ngày
              <input type="date" name="to" defaultValue={params.get('to') || ''} />
            </label>
            <label>
              Sắp xếp
              <select
                aria-label="Sắp xếp"
                name="sort"
                defaultValue={params.get('sort') || 'newest'}
              >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
                <option value="helpful">Hữu ích nhất</option>
              </select>
            </label>
          </div>
          <div className={styles.bar}>
            <button className={styles.primary}>Tìm kiếm</button>
            <button type="button" onClick={() => setParams({})}>
              Xóa bộ lọc
            </button>
          </div>
        </form>
      </State>
      <State query={query}>
        <h2>Danh sách tài liệu ({query.data?.total || 0})</h2>
        {query.data?.data.map((doc) => (
          <Card key={doc._id} doc={doc} catalog={catalog.data?.data} />
        ))}
        {!query.data?.total && <p>Không có tài liệu phù hợp.</p>}
        <Pager
          page={query.data?.page || 1}
          total={query.data?.total || 0}
          change={(page) => {
            const next = new URLSearchParams(params);
            next.set('page', page);
            setParams(next);
          }}
        />
      </State>
    </Layout>
  );
}
