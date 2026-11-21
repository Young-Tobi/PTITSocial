import React, { useState } from 'react';
import { useAcademic, useAcademicMutation } from './api';
import { Person, TextContent, Pager, QueryState, formValidation } from './Common';
import styles from './academic.module.css';
function Comments({ answerId }) {
  const [page, setPage] = useState(1);
  const [body, setBody] = useState('');
  const query = useAcademic('/academic/answers/' + answerId + '/comments?page=' + page);
  const mutation = useAcademicMutation(() => {
    setBody('');
    setPage(Math.ceil(((query.data?.total || 0) + 1) / 20));
  });
  return (
    <section className={styles.comments}>
      <h3>Thảo luận</h3>
      <QueryState query={query}>
        {query.data?.data.map((comment) => (
          <div key={comment._id} className={styles.comment}>
            <Person author={comment.author} createdAt={comment.createdAt} />
            <p>{comment.body}</p>
          </div>
        ))}
        {!query.data?.total && <p>Chưa có bình luận. Hãy bắt đầu trao đổi.</p>}
        <Pager page={page} total={query.data?.total || 0} onChange={setPage} />
      </QueryState>
      <form
        {...formValidation}
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate({ path: '/academic/answers/' + answerId + '/comments', data: { body } });
        }}
      >
        <label>
          Bình luận
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={1000}
            rows={3}
          />
        </label>
        <button disabled={mutation.isLoading}>Gửi bình luận</button>
      </form>
    </section>
  );
}
export default function AnswerCard({ answer, question, userId, accepted = false }) {
  const [showComments, setShowComments] = useState(false);
  const mutation = useAcademicMutation();
  const own = answer.author?._id === userId;
  return (
    <article className={styles.card} aria-label={accepted ? 'Lời giải được chọn' : 'Câu trả lời'}>
      {accepted && <strong className={styles.resolved}>Lời giải được chọn</strong>}
      <Person author={answer.author} createdAt={answer.createdAt} />
      <TextContent>{answer.body}</TextContent>
      <div className={styles.bar}>
        <button
          aria-pressed={answer.isHelpful}
          disabled={own || mutation.isLoading}
          title={
            own ? 'Bạn không thể bình chọn câu trả lời của mình' : 'Bình chọn câu trả lời hữu ích'
          }
          onClick={() =>
            mutation.mutate({
              path: '/academic/answers/' + answer._id + '/helpful',
              method: answer.isHelpful ? 'DELETE' : 'PUT',
            })
          }
        >
          Hữu ích ({answer.helpfulCount})
        </button>
        <button onClick={() => setShowComments(!showComments)} aria-expanded={showComments}>
          Thảo luận ({answer.commentCount})
        </button>
        {question.author?._id === userId && (
          <button
            disabled={mutation.isLoading}
            onClick={() =>
              mutation.mutate({
                path: '/academic/questions/' + question._id + '/accepted-answer',
                method: 'PUT',
                data: { answerId: accepted ? null : answer._id },
              })
            }
          >
            {accepted ? 'Bỏ chọn lời giải' : 'Chọn làm lời giải'}
          </button>
        )}
      </div>
      {showComments && <Comments answerId={answer._id} />}
    </article>
  );
}
