import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAcademic, useAcademicMutation, splitTags } from 'features/academic/api';
import { Layout, QueryState, formValidation } from 'features/academic/Common';
import styles from 'features/academic/academic.module.css';
function InterestsForm({ initial, subjects }) {
  const [selected, setSelected] = useState(initial.subjects || []);
  const [tags, setTags] = useState((initial.tags || []).join(', '));
  const mutation = useAcademicMutation(() => toast.success('Đã lưu lĩnh vực quan tâm.'));
  return (
    <form
      className={styles.card}
      {...formValidation}
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({
          path: '/academic/interests',
          method: 'PUT',
          data: { subjects: selected, tags: splitTags(tags) },
        });
      }}
    >
      <h2>Môn học</h2>
      <div className={styles.checks}>
        {subjects.map((s) => (
          <label key={s.id}>
            <input
              type="checkbox"
              checked={selected.includes(s.id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked ? [...selected, s.id] : selected.filter((id) => id !== s.id)
                )
              }
            />
            {s.name}
          </label>
        ))}
      </div>
      <label>
        Thẻ chủ đề
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tối đa 20 thẻ, cách nhau bằng dấu phẩy"
        />
      </label>
      <p>Nếu chưa chọn hoặc không có câu hỏi phù hợp, bạn sẽ thấy những câu hỏi mới nhất.</p>
      <button className={styles.primary} disabled={mutation.isLoading}>
        {mutation.isLoading ? 'Đang lưu…' : 'Lưu lĩnh vực quan tâm'}
      </button>
    </form>
  );
}
export default function Interests() {
  const subjects = useAcademic('/academic/subjects');
  const interests = useAcademic('/academic/interests');
  return (
    <Layout>
      <h1>Lĩnh vực quan tâm</h1>
      <QueryState query={subjects}>
        <QueryState query={interests}>
          {interests.data && subjects.data && (
            <InterestsForm initial={interests.data.data} subjects={subjects.data.data} />
          )}
        </QueryState>
      </QueryState>
    </Layout>
  );
}
