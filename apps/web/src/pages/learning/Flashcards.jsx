import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { FiArrowLeft, FiPlus, FiLayers, FiRefreshCw, FiTrash2, FiEdit2 } from 'react-icons/fi';
import LearningHeader from './LearningHeader';
import LearningTabs from './LearningTabs';
import GuideContent from './GuideContent';
import hub from './roadmaps.module.css';
import styles from './flashcards.module.css';

const base = `${process.env.REACT_APP_BACKEND_URL}/api/v1/learning`;
const options = { withCredentials: true, timeout: 110000 };
const blank = () => ({ front: '', back: '' });
const errorText = (error) =>
  error?.response?.data?.message || 'Chưa thực hiện được. Vui lòng kiểm tra kết nối và thử lại.';
const dateText = (date) =>
  new Date(date).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
const requestId = () =>
  window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-review`;

export default function Flashcards() {
  const user = useSelector((state) => state.user.userinfo?._id);
  const { deckId } = useParams();
  const [search, setSearch] = useSearchParams();
  const source = search.get('guide') || '';
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [editor, setEditor] = useState(null);
  const [guideId, setGuideId] = useState(source);
  const [revealed, setRevealed] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pendingReview = useRef(null);
  const listKey = ['flashcard-decks', user];
  const detailKey = ['flashcard-deck', user, deckId];
  const list = useQuery({
    queryKey: listKey,
    queryFn: async () => (await axios.get(`${base}/flashcards`, options)).data.decks,
    refetchInterval: 30000,
  });
  const detail = useQuery({
    queryKey: detailKey,
    enabled: Boolean(deckId),
    retry: false,
    refetchInterval: !reviewing && !editor ? 30000 : false,
    queryFn: async () => (await axios.get(`${base}/flashcards/${deckId}`, options)).data.deck,
  });
  const guides = useQuery({
    queryKey: ['flashcard-guides', user],
    enabled: !deckId,
    queryFn: async () =>
      (await axios.get(`${base}/sessions`, options)).data.sessions.filter(
        (item) => item.kind === 'guide'
      ),
  });
  const deck = detail.data;
  const card = reviewing
    ? deck?.cards.find((item) => new Date(item.dueAt).getTime() <= Date.now())
    : null;
  useEffect(() => {
    setRevealed(false);
    pendingReview.current = null;
  }, [card?._id]);
  useEffect(() => {
    setEditor(null);
    setReviewing(false);
    setConfirmDelete(false);
    setRevealed(false);
  }, [deckId]);
  const update = (value) => {
    cache.setQueryData(['flashcard-deck', user, value._id], value);
    cache.invalidateQueries({ queryKey: listKey });
  };
  const save = useMutation({
    mutationFn: async () =>
      (deckId
        ? await axios.put(
            `${base}/flashcards/${deckId}`,
            { ...editor, version: deck.version },
            options
          )
        : await axios.post(`${base}/flashcards`, editor, options)
      ).data.deck,
    onSuccess: (value) => {
      update(value);
      setEditor(null);
      setSearch({});
      navigate(`/learning/flashcards/${value._id}`);
    },
  });
  const generate = useMutation({
    mutationFn: async () =>
      (await axios.post(`${base}/flashcards/generate`, { guideId }, options)).data,
    onSuccess: (value) => {
      setEditor(value);
      save.reset();
    },
  });
  const review = useMutation({
    mutationFn: async (rating) => {
      const previous = pendingReview.current;
      if (!previous || previous.cardId !== card._id || previous.rating !== rating)
        pendingReview.current = {
          requestId: requestId(),
          cardId: card._id,
          rating,
          version: deck.version,
        };
      return (
        await axios.post(`${base}/flashcards/${deckId}/reviews`, pendingReview.current, options)
      ).data.deck;
    },
    onSuccess: (value) => {
      pendingReview.current = null;
      setRevealed(false);
      update(value);
    },
  });
  const remove = useMutation({
    mutationFn: () =>
      axios.delete(`${base}/flashcards/${deckId}`, { ...options, data: { version: deck.version } }),
    onSuccess: () => {
      cache.removeQueries({ queryKey: detailKey });
      cache.invalidateQueries({ queryKey: listKey });
      navigate('/learning/flashcards');
    },
  });
  const busy = save.isLoading || generate.isLoading || review.isLoading || remove.isLoading;
  const error =
    save.error || generate.error || review.error || remove.error || detail.error || list.error;
  const resetErrors = () => {
    save.reset();
    generate.reset();
    review.reset();
    remove.reset();
  };
  const changeCard = (index, field, value) =>
    setEditor((old) => ({
      ...old,
      cards: old.cards.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  const refresh = () => {
    resetErrors();
    pendingReview.current = null;
    if (deckId) detail.refetch();
    list.refetch();
  };
  return (
    <main className={`${hub.page} ${styles.page}`}>
      <LearningHeader />
      <LearningTabs />
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>FLASHCARD · ÔN TẬP NGẮT QUÃNG</p>
          <h1>{deck?.title || 'Học rồi, nhớ lâu hơn.'}</h1>
          <p>Lật thẻ, tự đánh giá và quay lại vào lịch ôn tiếp theo.</p>
        </div>
        {deckId ? (
          <Link to="/learning/flashcards">
            <FiArrowLeft /> Các bộ thẻ
          </Link>
        ) : (
          !editor && (
            <button
              className={styles.primary}
              onClick={() => {
                resetErrors();
                setEditor({ title: '', cards: [blank()] });
              }}
            >
              <FiPlus /> Tạo bộ thẻ
            </button>
          )
        )}
      </div>
      {error && (
        <div className={styles.error} role="alert">
          {errorText(error)}{' '}
          <button onClick={refresh} disabled={busy}>
            <FiRefreshCw /> Tải lại dữ liệu
          </button>
        </div>
      )}
      {(list.isLoading || (deckId && detail.isLoading)) && <p role="status">Đang tải bộ thẻ…</p>}
      {!deckId && !editor && (
        <>
          <section className={styles.generator} aria-label="Tạo thẻ bằng AI">
            <div>
              <h2>Tạo thẻ từ Guide</h2>
              <p>AI rút ra câu hỏi và đáp án. Bạn xem lại trước khi lưu.</p>
            </div>
            <label>
              Bài Guide
              <select
                value={guideId}
                onChange={(event) => setGuideId(event.target.value)}
                disabled={busy}
              >
                <option value="">Chọn bài hướng dẫn đã học</option>
                {(guides.data || []).map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.goal}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={!guideId || busy}
              onClick={() => {
                resetErrors();
                generate.mutate();
              }}
            >
              {generate.isLoading ? 'AI đang tạo thẻ…' : 'Tạo bằng AI'}
            </button>
            {guides.isError && (
              <p role="alert">
                Không tải được danh sách Guide.{' '}
                <button onClick={() => guides.refetch()}>Thử lại</button>
              </p>
            )}
            {!guides.isLoading && !guides.isError && !guides.data?.length && (
              <p>
                Chưa có bài Guide? <Link to="/learning/ai">Học với AI</Link> hoặc tạo thẻ thủ công.
              </p>
            )}
          </section>
          {list.data && (
            <>
              <div className={styles.stats}>
                <span>
                  <strong>{list.data.reduce((n, item) => n + item.due, 0)}</strong> thẻ đến lịch ôn
                </span>
                <span>
                  <strong>{list.data.reduce((n, item) => n + item.reviewedToday, 0)}</strong> thẻ đã
                  ôn hôm nay
                </span>
                <span>
                  <strong>{list.data.length}</strong> bộ thẻ của bạn
                </span>
              </div>
              {!!list.data.some((item) => item.due > 0) && (
                <p className={styles.reminder} role="status">
                  Đến giờ ôn rồi! Chọn một bộ thẻ bên dưới để tiếp tục.
                </p>
              )}
              <div className={styles.grid}>
                {list.data.map((item) => (
                  <Link
                    key={item._id}
                    to={`/learning/flashcards/${item._id}`}
                    className={styles.deck}
                  >
                    <FiLayers />
                    <h2>{item.title}</h2>
                    <p>
                      {item.total} thẻ · {item.learned} thẻ đã nhớ
                    </p>
                    <span>
                      {item.due
                        ? `${item.due} thẻ cần ôn`
                        : `Lịch tiếp theo: ${dateText(item.nextDueAt)}`}
                    </span>
                    <progress
                      aria-label={`Tiến độ ${item.title}`}
                      max={item.total}
                      value={item.learned}
                    />
                  </Link>
                ))}
              </div>
              {!list.data.length && (
                <div className={styles.empty}>
                  <FiLayers />
                  <h2>Bộ thẻ đầu tiên của bạn</h2>
                  <p>Ghi một câu hỏi ở mặt trước, câu trả lời ở mặt sau và bắt đầu ôn.</p>
                </div>
              )}
            </>
          )}
        </>
      )}
      {editor && (
        <form
          className={styles.editor}
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) save.mutate();
          }}
        >
          <h2>{deckId ? 'Chỉnh sửa bộ thẻ' : 'Xem lại và lưu bộ thẻ'}</h2>
          {editor.sourceGuide && (
            <p>Thẻ do AI gợi ý. Hãy kiểm tra câu hỏi và đáp án trước khi học.</p>
          )}
          {deckId && (
            <p>
              Sửa nội dung thẻ sẽ đưa thẻ đó về lịch ôn mới; các thẻ giữ nguyên nội dung vẫn giữ
              tiến độ.
            </p>
          )}
          <fieldset disabled={busy}>
            <label>
              Tên bộ thẻ
              <input
                autoFocus
                required
                maxLength={120}
                value={editor.title}
                onChange={(event) => setEditor({ ...editor, title: event.target.value })}
              />
            </label>
            {editor.cards.map((item, index) => (
              <div key={item._id || index} className={styles.editCard}>
                <div className={styles.row}>
                  <strong>Thẻ {index + 1}</strong>
                  <button
                    type="button"
                    aria-label={`Xóa thẻ ${index + 1}`}
                    disabled={editor.cards.length === 1}
                    onClick={() =>
                      setEditor({ ...editor, cards: editor.cards.filter((_, i) => i !== index) })
                    }
                  >
                    <FiTrash2 />
                  </button>
                </div>
                <label>
                  Câu hỏi
                  <textarea
                    required
                    maxLength={1000}
                    value={item.front}
                    onChange={(event) => changeCard(index, 'front', event.target.value)}
                  />
                </label>
                <label>
                  Đáp án
                  <textarea
                    required
                    maxLength={6000}
                    rows={4}
                    value={item.back}
                    onChange={(event) => changeCard(index, 'back', event.target.value)}
                  />
                </label>
              </div>
            ))}
            <div className={styles.row}>
              <button
                type="button"
                disabled={editor.cards.length >= 100}
                onClick={() => setEditor({ ...editor, cards: [...editor.cards, blank()] })}
              >
                <FiPlus /> Thêm thẻ
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditor(null);
                  resetErrors();
                }}
              >
                Hủy
              </button>
              <button className={styles.primary} type="submit">
                {save.isLoading ? 'Đang lưu…' : 'Lưu bộ thẻ'}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {deck && !editor && (
        <>
          <div className={styles.stats}>
            <span>
              <strong>{deck.total}</strong> thẻ
            </span>
            <span>
              <strong>{deck.due}</strong> đến lịch
            </span>
            <span>
              <strong>{deck.reviewedToday}</strong> đã ôn hôm nay
            </span>
          </div>
          {!reviewing ? (
            <section className={styles.overview}>
              <h2>{deck.due ? 'Sẵn sàng ôn tập?' : 'Bạn đã ôn hết thẻ đến lịch.'}</h2>
              <p>
                {deck.due
                  ? 'Thử nhớ câu trả lời trước khi lật thẻ. Chọn đúng mức bạn nhớ để đặt lịch lần sau.'
                  : `Lịch ôn gần nhất: ${dateText(deck.nextDueAt)}.`}
              </p>
              <div className={styles.row}>
                <button
                  className={styles.primary}
                  disabled={!deck.due}
                  onClick={() => {
                    resetErrors();
                    setReviewing(true);
                  }}
                >
                  Bắt đầu ôn
                </button>
                <button
                  onClick={() => {
                    resetErrors();
                    setEditor({
                      title: deck.title,
                      cards: deck.cards.map(({ _id, front, back }) => ({ _id, front, back })),
                    });
                  }}
                >
                  <FiEdit2 /> Chỉnh sửa
                </button>
                <button onClick={() => setConfirmDelete(!confirmDelete)}>
                  <FiTrash2 /> Xóa bộ thẻ
                </button>
                <button aria-label="Cập nhật lịch ôn" onClick={refresh}>
                  <FiRefreshCw />
                </button>
              </div>
              {confirmDelete && (
                <div className={styles.confirm}>
                  <p>Xóa bộ thẻ cùng toàn bộ tiến độ ôn tập?</p>
                  <button disabled={busy} onClick={() => remove.mutate()}>
                    Xác nhận xóa
                  </button>
                  <button disabled={busy} onClick={() => setConfirmDelete(false)}>
                    Giữ lại
                  </button>
                </div>
              )}
            </section>
          ) : card ? (
            <section className={styles.study} aria-label="Ôn tập flashcard">
              <div className={styles.row}>
                <span>Còn {deck.due} thẻ đến lịch</span>
                <button disabled={busy} onClick={() => setReviewing(false)}>
                  Kết thúc
                </button>
              </div>
              <p className={styles.eyebrow}>CÂU HỎI</p>
              <GuideContent content={card.front} />
              {revealed ? (
                <>
                  <div className={styles.answer}>
                    <p className={styles.eyebrow}>ĐÁP ÁN</p>
                    <GuideContent content={card.back} />
                  </div>
                  <p>Bạn nhớ được đến đâu?</p>
                  <div className={styles.ratings}>
                    <button disabled={busy} onClick={() => review.mutate('again')}>
                      Quên<small>Ôn lại sau 10 phút</small>
                    </button>
                    <button disabled={busy} onClick={() => review.mutate('hard')}>
                      Khó<small>Giãn lịch chậm hơn</small>
                    </button>
                    <button disabled={busy} onClick={() => review.mutate('good')}>
                      Nhớ<small>Tăng khoảng cách ôn</small>
                    </button>
                  </div>
                </>
              ) : (
                <button className={styles.primary} onClick={() => setRevealed(true)}>
                  Hiện đáp án
                </button>
              )}
              {review.isLoading && <p role="status">Đang lưu lịch ôn…</p>}
            </section>
          ) : (
            <section className={styles.empty} role="status">
              <h2>Hoàn thành lượt ôn!</h2>
              <p>Lịch tiếp theo: {dateText(deck.nextDueAt)}. Hẹn gặp lại bạn.</p>
              <button onClick={() => setReviewing(false)}>Về bộ thẻ</button>
            </section>
          )}
        </>
      )}
    </main>
  );
}
