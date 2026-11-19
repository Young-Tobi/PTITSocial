import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { studyApi, errorMessage } from 'features/study/api';
import styles from './studySpot.module.css';

export default function MyMeetups() {
  const [data, setData] = useState({ organized: [], registrations: [], requests: [] });
  const load = async () => {
    try {
      const response = await studyApi.get('/meetups/mine');
      setData(response.data.data);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  useEffect(() => {
    load();
  }, []);
  const decide = async (id, status) => {
    try {
      await studyApi.patch(`/registrations/${id}/decision`, { status });
      toast.success(status === 'accepted' ? 'Đã chấp nhận' : 'Đã từ chối');
      load();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const cancelReg = async (id) => {
    try {
      await studyApi.patch(`/registrations/${id}/cancel`);
      load();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const cancelMeetup = async (id) => {
    try {
      await studyApi.patch(`/meetups/${id}/cancel`);
      load();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  return (
    <main className={styles.managePage}>
      <div className={styles.manageHeader}>
        <div>
          <span>STUDY MEETUP</span>
          <h1>Lịch học cùng nhau</h1>
          <p>Quản lý lời mời bạn tạo và những buổi bạn đã đăng ký.</p>
        </div>
        <Link to="/study-spots">Mở bản đồ</Link>
      </div>
      <section className={styles.manageSection}>
        <h2>Do tôi tổ chức</h2>
        <div className={styles.manageGrid}>
          {data.organized.map((item) => (
            <article key={item._id}>
              <span className={styles[item.status]}>{item.status}</span>
              <h3>{item.title}</h3>
              <p>
                {item.subject} · {item.location?.name}
              </p>
              <small>
                {new Date(item.startsAt).toLocaleString('vi-VN')} · {item.acceptedCount}/
                {item.maxParticipants} người
              </small>
              {item.status === 'scheduled' && (
                <button onClick={() => cancelMeetup(item._id)}>Hủy buổi học</button>
              )}
              <div className={styles.requestList}>
                {data.requests
                  .filter(
                    (r) =>
                      String(r.meetup) === item._id && ['pending', 'accepted'].includes(r.status)
                  )
                  .map((request) => (
                    <div key={request._id}>
                      <img src={request.user?.photo} alt="" />
                      <span>
                        {request.user?.first_name} {request.user?.last_name}{' '}
                        {request.status === 'accepted' ? '· Đã duyệt' : ''}
                      </span>
                      {request.status === 'pending' && (
                        <>
                          <button onClick={() => decide(request._id, 'accepted')}>Duyệt</button>
                          <button onClick={() => decide(request._id, 'rejected')}>Từ chối</button>
                        </>
                      )}
                    </div>
                  ))}
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className={styles.manageSection}>
        <h2>Đã đăng ký</h2>
        <div className={styles.manageGrid}>
          {data.registrations.map((reg) => (
            <article key={reg._id}>
              <span className={styles[reg.status]}>{reg.status}</span>
              <h3>{reg.meetup?.title}</h3>
              <p>
                {reg.meetup?.subject} · {reg.meetup?.location?.name}
              </p>
              <small>
                {reg.meetup?.startsAt && new Date(reg.meetup.startsAt).toLocaleString('vi-VN')}
              </small>
              {['pending', 'accepted'].includes(reg.status) && (
                <button onClick={() => cancelReg(reg._id)}>Hủy đăng ký</button>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
