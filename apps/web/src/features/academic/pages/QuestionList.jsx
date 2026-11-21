import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAcademic } from 'features/academic/api';
import { Layout, QueryState, Pager, QuestionCard, formValidation } from 'features/academic/Common';
import styles from 'features/academic/academic.module.css';
export default function QuestionList() {
  const [params, setParams] = useSearchParams();
  const subjects = useAcademic('/academic/subjects');
  const questions = useAcademic('/academic/questions?' + params.toString());
  const recommendations = useAcademic('/academic/questions/recommended');
  function search(e) {
    e.preventDefault();
    const next = new URLSearchParams();
    for (const [key, value] of new FormData(e.currentTarget))
      if (value.trim()) next.set(key, value.trim());
    setParams(next);
  }
  const list = subjects.data?.data || [];
  return (
    <Layout>
      <h1>Hỏi đáp học thuật</h1>
      <p>Đặt câu hỏi, cùng thảo luận và tìm lời giải cho vấn đề học tập.</p>
      <section className={styles.card}>
        <h2>Gợi ý cho bạn</h2>
        <Link to="/questions/interests">Chọn lĩnh vực quan tâm</Link>
        <QueryState query={recommendations}>
          {recommendations.data?.data.length ? (
            recommendations.data.data.map((q) => (
              <QuestionCard key={q._id} question={q} subjects={list} />
            ))
          ) : (
            <p>Chưa có câu hỏi để gợi ý.</p>
          )}
        </QueryState>
      </section>
      <QueryState query={subjects}>
        <form key={params.toString()} onSubmit={search} className={styles.card} {...formValidation}>
          <label>
            Tìm kiếm
            <input
              name="q"
              maxLength={200}
              defaultValue={params.get('q') || ''}
              placeholder="Tìm theo tiêu đề hoặc nội dung"
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
                {list.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Thẻ chủ đề
              <input
                name="tags"
                defaultValue={params.get('tags') || ''}
                placeholder="mongodb, node.js"
              />
            </label>
            <label>
              Trạng thái
              <select
                aria-label="Trạng thái"
                name="status"
                defaultValue={params.get('status') || ''}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="resolved">Đã giải quyết</option>
                <option value="unresolved">Chưa giải quyết</option>
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
          </div>
          <div className={styles.bar}>
            <button className={styles.primary}>Tìm kiếm</button>
            <button type="button" onClick={() => setParams({})}>
              Xóa bộ lọc
            </button>
          </div>
        </form>
        <QueryState query={questions}>
          <h2>Danh sách câu hỏi ({questions.data?.total || 0})</h2>
          {questions.data?.data.length ? (
            questions.data.data.map((q) => (
              <QuestionCard key={q._id} question={q} subjects={list} />
            ))
          ) : (
            <p>Không có câu hỏi phù hợp. Hãy thử bộ lọc khác hoặc đặt câu hỏi mới.</p>
          )}
          <Pager
            page={questions.data?.page || 1}
            total={questions.data?.total || 0}
            limit={questions.data?.limit || 20}
            onChange={(page) => {
              const next = new URLSearchParams(params);
              next.set('page', page);
              setParams(next);
            }}
          />
        </QueryState>
      </QueryState>
    </Layout>
  );
}
