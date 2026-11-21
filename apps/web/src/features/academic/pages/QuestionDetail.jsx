import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import { useAcademic, useAcademicMutation } from 'features/academic/api';
import {
  Layout,
  QueryState,
  Person,
  TextContent,
  Pager,
  Editor,
  formValidation,
} from 'features/academic/Common';
import AnswerCard from 'features/academic/AnswerCard';
import styles from 'features/academic/academic.module.css';
function Detail({ id }) {
  const userId = useSelector((state) => state.user.userinfo?._id);
  const [page, setPage] = useState(1);
  const [body, setBody] = useState('');
  const query = useAcademic('/academic/questions/' + id);
  const answers = useAcademic('/academic/questions/' + id + '/answers?page=' + page);
  const subjects = useAcademic('/academic/subjects');
  const mutation = useAcademicMutation(() => {
    setBody('');
    toast.success('Đã gửi câu trả lời.');
    setPage(Math.ceil(((answers.data?.total || 0) + 1) / 20));
  });
  const question = query.data?.data;
  return (
    <Layout>
      <QueryState query={query}>
        {question && (
          <>
            <article className={styles.card}>
              <span className={question.resolved ? styles.resolved : styles.badge}>
                {question.resolved ? 'Đã giải quyết' : 'Chưa giải quyết'}
              </span>
              <h1>{question.title}</h1>
              <Person author={question.author} createdAt={question.createdAt} />
              <p>{subjects.data?.data.find((s) => s.id === question.subject)?.name}</p>
              <div className={styles.bar}>
                {question.tags.map((tag) => (
                  <span className={styles.badge} key={tag}>
                    #{tag}
                  </span>
                ))}
              </div>
              <TextContent>{question.body}</TextContent>
            </article>
            <h2>Câu trả lời</h2>
            {question.acceptedAnswer && (
              <AnswerCard
                key={question.acceptedAnswer._id + '-accepted'}
                answer={question.acceptedAnswer}
                question={question}
                userId={userId}
                accepted
              />
            )}
            <QueryState query={answers}>
              {answers.data?.data.map((answer) => (
                <AnswerCard key={answer._id} answer={answer} question={question} userId={userId} />
              ))}
              {!answers.data?.total && !question.acceptedAnswer && (
                <p>Chưa có câu trả lời. Hãy chia sẻ cách giải quyết của bạn.</p>
              )}
              <Pager page={page} total={answers.data?.total || 0} onChange={setPage} />
            </QueryState>
            {question.author?._id !== userId ? (
              <form
                className={styles.card}
                {...formValidation}
                onSubmit={(e) => {
                  e.preventDefault();
                  mutation.mutate({
                    path: '/academic/questions/' + id + '/answers',
                    data: { body },
                  });
                }}
              >
                <h2>Câu trả lời của bạn</h2>
                <Editor
                  value={body}
                  onChange={setBody}
                  label="Nội dung câu trả lời (10–20.000 ký tự)"
                />
                <button className={styles.primary} disabled={mutation.isLoading}>
                  {mutation.isLoading ? 'Đang gửi…' : 'Gửi câu trả lời'}
                </button>
              </form>
            ) : (
              <p>
                Bạn có thể trao đổi dưới các câu trả lời và chọn lời giải khi vấn đề được giải
                quyết.
              </p>
            )}
          </>
        )}
      </QueryState>
    </Layout>
  );
}
export default function QuestionDetail() {
  const { questionId } = useParams();
  return <Detail key={questionId} id={questionId} />;
}
