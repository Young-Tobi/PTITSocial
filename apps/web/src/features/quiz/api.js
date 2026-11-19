import axios from 'axios';

export async function quizRequest(method, path, data) {
  const response = await axios({
    method,
    url: `${process.env.REACT_APP_BACKEND_URL}/api/v1/quiz${path}`,
    data,
    withCredentials: true,
  });
  return response.data.data;
}

export function errorMessage(error) {
  return error?.response?.data?.message || 'Chưa kết nối được. Vui lòng thử lại.';
}

export const points = (value) => Number(value || 0).toLocaleString('vi-VN');
export const roomLabel = (status) =>
  ({ waiting: 'Đang chờ', running: 'Đang diễn ra', finished: 'Đã kết thúc' })[status] || status;
