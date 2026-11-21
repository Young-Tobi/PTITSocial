import axios from 'axios';
export async function codingRequest(method, path, data) {
  const response = await axios({
    method,
    url: `${process.env.REACT_APP_BACKEND_URL}/api/v1/coding${path}`,
    data,
    withCredentials: true,
  });
  return response.data.data;
}
export const errorMessage = (error) =>
  error?.response?.data?.message || 'Chưa kết nối được. Vui lòng thử lại.';
export const roomLabel = (status) =>
  ({ waiting: 'Đang chờ', running: 'Đang thi đấu', finished: 'Đã kết thúc' })[status];
export const clock = (seconds) =>
  `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;
