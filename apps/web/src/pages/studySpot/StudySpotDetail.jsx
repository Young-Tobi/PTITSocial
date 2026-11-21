import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FiArrowLeft, FiCalendar, FiClock, FiMapPin, FiUsers, FiWifi, FiZap } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { studyApi, errorMessage } from 'features/study/api';
import styles from './studySpot.module.css';

export default function StudySpotDetail() {
  const { locationId } = useParams();
  const me = useSelector((state) => state.user.userinfo);
  const [deletingReview, setDeletingReview] = useState(null);
  const [data, setData] = useState(null);
  const [review, setReview] = useState({ rating: 5, comment: '' });
  const [meetup, setMeetup] = useState({
    title: '',
    subject: '',
    goal: '',
    description: '',
    startsAt: '',
    endsAt: '',
    maxParticipants: 6,
  });
  const load = async () => {
    try {
      const response = await studyApi.get(`/locations/${locationId}`);
      setData(response.data.data);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  useEffect(() => {
    let active = true;
    studyApi
      .get(`/locations/${locationId}`)
      .then((response) => {
        if (active) setData(response.data.data);
      })
      .catch((error) => toast.error(errorMessage(error)));
    return () => {
      active = false;
    };
  }, [locationId]);
  const submitReview = async (e) => {
    e.preventDefault();
    try {
      await studyApi.put(`/locations/${locationId}/review`, review);
      toast.success('Đã lưu đánh giá');
      setReview({ rating: 5, comment: '' });
      load();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const createMeetup = async (e) => {
    e.preventDefault();
    try {
      await studyApi.post('/meetups', { ...meetup, location: locationId });
      toast.success('Đã tạo lời mời học chung');
      setMeetup({ ...meetup, title: '', subject: '', goal: '', description: '' });
      load();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const deleteReview = async (id) => {
    if (!window.confirm('Xóa đánh giá của bạn?')) return;
    setDeletingReview(id);
    try {
      await studyApi.delete(`/reviews/${id}`);
      toast.success('Đã xóa đánh giá');
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeletingReview(null);
    }
  };
  const request = async (id) => {
    try {
      await studyApi.post(`/meetups/${id}/request`, {});
      toast.success('Đã gửi yêu cầu tham gia');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  if (!data) return <main className={styles.loading}>Đang tải địa điểm…</main>;
  const { location, reviews, meetups } = data;
  return (
    <main className={styles.detailPage}>
      <Link className={styles.back} to="/study-spots">
        <FiArrowLeft /> Trở lại bản đồ
      </Link>
      <section className={styles.locationHero}>
        <div className={styles.locationHeroArt}>
          {location.image ? <img src={location.image} alt="" /> : <FiMapPin />}
          {location.isSample && <span>DỮ LIỆU MẪU · CHƯA XÁC MINH</span>}
          {!location.isSample && location.externalSource === 'openstreetmap' && (
            <span>OPENSTREETMAP · CẦN XÁC MINH TIỆN ÍCH</span>
          )}
        </div>
        <div>
          <small>{location.type.replace('-', ' ')}</small>
          <h1>{location.name}</h1>
          <p>
            <FiMapPin /> {location.address}
          </p>
          <p>{location.description}</p>
          {location.sourceUrl && (
            <a
              className={styles.sourceLink}
              href={location.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Xem dữ liệu gốc trên OpenStreetMap
            </a>
          )}
          <div className={styles.detailStats}>
            <span>★ {location.averageRating.toFixed(1)} / 5</span>
            <span>Yên tĩnh {location.quietLevel}/5</span>
            {location.wifi && (
              <span>
                <FiWifi /> Wi-Fi
              </span>
            )}
            {location.powerOutlets && (
              <span>
                <FiZap /> Ổ cắm
              </span>
            )}
          </div>
        </div>
      </section>
      <div className={styles.detailGrid}>
        <section className={styles.detailCard}>
          <div className={styles.sectionTitle}>
            <div>
              <span>HỌC CÙNG NHAU</span>
              <h2>Meetup sắp tới</h2>
            </div>
            <FiCalendar />
          </div>
          <div className={styles.meetupList}>
            {meetups.length ? (
              meetups.map((item) => (
                <article key={item._id}>
                  <div>
                    <small>
                      <FiClock /> {new Date(item.startsAt).toLocaleString('vi-VN')}
                    </small>
                    <h3>{item.title}</h3>
                    <p>
                      {item.subject} · {item.goal}
                    </p>
                    <span>
                      <FiUsers /> Còn {item.maxParticipants - item.acceptedCount} suất đăng ký
                    </span>
                    <span>
                      Tổ chức bởi {item.organizer?.last_name} {item.organizer?.first_name}
                    </span>
                  </div>
                  <button onClick={() => request(item._id)}>Xin tham gia</button>
                </article>
              ))
            ) : (
              <p className={styles.muted}>Chưa có Meetup nào tại địa điểm này.</p>
            )}
          </div>
          <form className={styles.inlineForm} onSubmit={createMeetup}>
            <h3>Tạo buổi học chung</h3>
            <div className={styles.twoCols}>
              <input
                required
                placeholder="Tiêu đề"
                value={meetup.title}
                onChange={(e) => setMeetup({ ...meetup, title: e.target.value })}
              />
              <input
                required
                placeholder="Môn học / chủ đề"
                value={meetup.subject}
                onChange={(e) => setMeetup({ ...meetup, subject: e.target.value })}
              />
            </div>
            <input
              placeholder="Mục tiêu học tập"
              value={meetup.goal}
              onChange={(e) => setMeetup({ ...meetup, goal: e.target.value })}
            />
            <textarea
              placeholder="Mô tả thêm"
              value={meetup.description}
              onChange={(e) => setMeetup({ ...meetup, description: e.target.value })}
            />
            <div className={styles.threeCols}>
              <label>
                Bắt đầu
                <input
                  required
                  type="datetime-local"
                  value={meetup.startsAt}
                  onChange={(e) => setMeetup({ ...meetup, startsAt: e.target.value })}
                />
              </label>
              <label>
                Kết thúc
                <input
                  required
                  type="datetime-local"
                  value={meetup.endsAt}
                  onChange={(e) => setMeetup({ ...meetup, endsAt: e.target.value })}
                />
              </label>
              <label>
                Số người
                <input
                  min="2"
                  max="100"
                  type="number"
                  value={meetup.maxParticipants}
                  onChange={(e) =>
                    setMeetup({ ...meetup, maxParticipants: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <button>Tạo Meetup</button>
          </form>
        </section>
        <aside className={styles.detailCard}>
          <div className={styles.sectionTitle}>
            <div>
              <span>CỘNG ĐỒNG</span>
              <h2>{reviews.length} đánh giá</h2>
            </div>
            <b>★ {location.averageRating.toFixed(1)}</b>
          </div>
          <form className={styles.reviewForm} onSubmit={submitReview}>
            <label>
              Điểm
              <select
                value={review.rating}
                onChange={(e) => setReview({ ...review, rating: Number(e.target.value) })}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {'★'.repeat(n)} ({n})
                  </option>
                ))}
              </select>
            </label>
            <textarea
              maxLength="1000"
              placeholder="Chia sẻ trải nghiệm của bạn…"
              value={review.comment}
              onChange={(e) => setReview({ ...review, comment: e.target.value })}
            />
            <button>Lưu đánh giá</button>
          </form>
          <div className={styles.reviewList}>
            {reviews.map((item) => (
              <article key={item._id}>
                <img src={item.user?.photo} alt="" />
                <div>
                  <b>
                    {item.user?.last_name} {item.user?.first_name}
                  </b>
                  <span>{'★'.repeat(item.rating)}</span>
                  <p>{item.comment}</p>
                  <small>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</small>
                  {String(item.user?._id) === String(me?._id) && (
                    <button
                      type="button"
                      className={styles.deleteReview}
                      disabled={deletingReview === item._id}
                      onClick={() => deleteReview(item._id)}
                    >
                      {deletingReview === item._id ? 'Đang xóa…' : 'Xóa đánh giá'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
