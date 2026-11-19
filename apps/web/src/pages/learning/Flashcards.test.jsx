import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import Flashcards from './Flashcards';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
jest.mock('react-redux', () => ({
  useSelector: (select) => select({ user: { userinfo: { _id: 'student' } } }),
}));
const original = {
  _id: 'deck-1',
  title: 'Python',
  version: 0,
  total: 1,
  due: 1,
  learned: 0,
  reviewedToday: 0,
  cards: [
    {
      _id: 'card-1',
      front: 'Biến là gì?',
      back: 'Dùng để lưu dữ liệu.',
      dueAt: '2020-01-01',
      intervalDays: 0,
      reviews: 0,
    },
  ],
  nextDueAt: '2020-01-01',
};
function mount(route = '/learning/flashcards') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    logger: { log: () => {}, warn: () => {}, error: () => {} },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/learning/flashcards" element={<Flashcards />} />
          <Route path="/learning/flashcards/:deckId" element={<Flashcards />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockImplementation((url) =>
    Promise.resolve({
      data: url.endsWith('/sessions')
        ? { sessions: [{ _id: 'guide-1', kind: 'guide', goal: 'Python guide' }] }
        : url.endsWith('/flashcards')
          ? { decks: [] }
          : { deck: original },
    })
  );
});
test('manual creation submits only the draft and opens the saved deck', async () => {
  axios.post.mockResolvedValue({ data: { deck: original } });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Tạo bộ thẻ' }));
  fireEvent.change(screen.getByLabelText('Tên bộ thẻ'), { target: { value: 'Python' } });
  fireEvent.change(screen.getByLabelText('Câu hỏi'), { target: { value: 'Biến là gì?' } });
  fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: 'Dùng để lưu dữ liệu.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu bộ thẻ' }));
  await waitFor(() =>
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/flashcards'),
      { title: 'Python', cards: [{ front: 'Biến là gì?', back: 'Dùng để lưu dữ liệu.' }] },
      expect.any(Object)
    )
  );
  expect(await screen.findByRole('button', { name: 'Bắt đầu ôn' })).toBeEnabled();
});
test('AI generation remains editable and is not automatically saved', async () => {
  axios.post.mockResolvedValue({
    data: {
      title: 'Ôn Python',
      sourceGuide: 'guide-1',
      cards: [{ front: 'Câu hỏi AI', back: 'Đáp án AI' }],
    },
  });
  mount('/learning/flashcards?guide=guide-1');
  await screen.findByRole('option', { name: 'Python guide' });
  fireEvent.click(screen.getByRole('button', { name: 'Tạo bằng AI' }));
  expect(await screen.findByDisplayValue('Câu hỏi AI')).toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining('/flashcards/generate'),
    { guideId: 'guide-1' },
    expect.any(Object)
  );
  fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: 'Đáp án đã sửa' } });
  expect(screen.getByDisplayValue('Đáp án đã sửa')).toBeInTheDocument();
});
test('answer is hidden first, successful rating persists and completes due cards', async () => {
  axios.post.mockResolvedValue({
    data: {
      deck: {
        ...original,
        version: 1,
        due: 0,
        reviewedToday: 1,
        nextDueAt: '2099-01-01',
        cards: [{ ...original.cards[0], dueAt: '2099-01-01' }],
      },
    },
  });
  mount('/learning/flashcards/deck-1');
  fireEvent.click(await screen.findByRole('button', { name: 'Bắt đầu ôn' }));
  expect(screen.queryByText('Dùng để lưu dữ liệu.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Hiện đáp án' }));
  expect(screen.getByText('Dùng để lưu dữ liệu.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Nhớ Tăng/ }));
  expect(await screen.findByText('Hoàn thành lượt ôn!')).toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining('/deck-1/reviews'),
    expect.objectContaining({
      cardId: 'card-1',
      rating: 'good',
      version: 0,
      requestId: expect.any(String),
    }),
    expect.any(Object)
  );
});
test('a failed review keeps the answer and retries the same idempotency token', async () => {
  axios.post.mockRejectedValue({ response: { data: { message: 'Mất kết nối thử nghiệm' } } });
  mount('/learning/flashcards/deck-1');
  fireEvent.click(await screen.findByRole('button', { name: 'Bắt đầu ôn' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hiện đáp án' }));
  fireEvent.click(screen.getByRole('button', { name: /Quên Ôn lại/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Mất kết nối thử nghiệm');
  expect(screen.getByText('Dùng để lưu dữ liệu.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Quên Ôn lại/ }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));
  expect(axios.post.mock.calls[0][1].requestId).toBe(axios.post.mock.calls[1][1].requestId);
});
