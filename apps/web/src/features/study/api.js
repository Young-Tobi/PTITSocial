import axios from 'axios';
import { normalizeMediaLinks } from 'shared/lib/mediaLinks';

export const studyApi = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api/v1/study`,
  withCredentials: true,
});

studyApi.interceptors.response.use((response) => {
  normalizeMediaLinks(response.data);
  return response;
});

export function errorMessage(error) {
  return error?.response?.data?.message || error?.message || 'Đã có lỗi xảy ra';
}
