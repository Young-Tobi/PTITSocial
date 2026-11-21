import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import Left from './messages/Left';
import PostPage from './post/PostPage';

jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('features/messaging/components/MessageContext', () => ({ messagePreview: () => '' }));
jest.mock('features/messaging/hooks/useGetChat', () => ({ useGetChat: () => ({ mutate: jest.fn() }) }));
jest.mock('features/messaging/components/SearchUser', () => () => null);
jest.mock('features/messaging/components/createGroup/CreateGroup', () => () => null);
jest.mock('./messages/SeenStatus', () => () => null);
jest.mock('features/posts/components/post/index', () => () => <div>Bài viết thử</div>);
jest.mock('shared/components/skeleton/PostSkeleton', () => () => null);

function wrap(component, initialEntries = ['/']) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
    logger: { log: console.log, warn: console.warn, error: () => {} },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>{component}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => axios.get.mockReset());

test('online contacts include accepted friends and exclude strangers, self and offline friends', async () => {
  axios.get.mockImplementation(async (url) => ({ data: url.includes('friendsPage')
    ? { data: { friendLists: [{ _id: 'friend' }, { _id: 'offline' }], recivedRequests: [{ sender: { _id: 'stranger' } }] } }
    : { data: { chats: [] } } }));
  wrap(<Left user={{ _id: 'self' }} soketSlice={{ onlineUsers: [
    { id: 'self', first_name: 'Tôi' },
    { id: 'friend', first_name: 'Khoa' },
    { id: 'stranger', first_name: 'Công' },
  ] }} />);
  const contacts = within(screen.getByRole('region', { name: 'Bạn bè đang hoạt động' }));
  await contacts.findByText('Khoa');
  expect(contacts.queryByText('Công')).toBeNull();
  expect(contacts.queryByText('Tôi')).toBeNull();
});

test('a failed friend-list request does not display online strangers as contacts', async () => {
  axios.get.mockImplementation(async (url) => {
    if (url.includes('friendsPage')) throw new Error('Unavailable');
    return { data: { data: { chats: [] } } };
  });
  wrap(<Left user={{ _id: 'self' }} soketSlice={{ onlineUsers: [{ id: 'stranger', first_name: 'Công' }] }} />);
  await waitFor(() => expect(screen.queryByText('Chưa có bạn bè đang hoạt động.')).not.toBeNull());
  expect(screen.queryByText('Công')).toBeNull();
});

test('a post opened directly has a link back to the feed without relying on browser history', async () => {
  axios.get.mockResolvedValue({ data: { data: { post: {} } } });
  wrap(<Routes>
    <Route path="/demo/posts/:post" element={<PostPage />} />
    <Route path="/" element={<div>Bảng tin thử</div>} />
  </Routes>, ['/demo/posts/post-id']);
  const link = screen.getByRole('link', { name: 'Quay lại bảng tin' });
  expect(link.getAttribute('href')).toBe('/');
  await screen.findByText('Bài viết thử');
  fireEvent.click(link);
  await screen.findByText('Bảng tin thử');
});
