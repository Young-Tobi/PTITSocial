import axios from 'axios';

export const studyApi = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api/v1/study`,
  withCredentials: true,
});

export function errorMessage(error) {
  return error?.response?.data?.message || error?.message || 'Đã có lỗi xảy ra';
}
