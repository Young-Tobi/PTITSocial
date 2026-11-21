import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
const base = process.env.REACT_APP_BACKEND_URL + '/api/v1';
export async function request(path, method = 'GET', data) {
  try {
    return (await axios({ url: base + path, method, data, withCredentials: true })).data;
  } catch (error) {
    const status = error.response?.status;
    const message =
      status === 401
        ? 'Vui lòng đăng nhập để tiếp tục.'
        : status >= 500 || !status
          ? 'Không thể kết nối máy chủ. Vui lòng thử lại.'
          : error.response?.data?.message || 'Không thể thực hiện thao tác.';
    throw new Error(message);
  }
}
export function useAcademic(path) {
  return useQuery({ queryKey: ['academic', path], queryFn: () => request(path), retry: false });
}
export function useAcademicMutation(onSuccess) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ path, method = 'POST', data }) => request(path, method, data),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ['academic'] });
      onSuccess?.(result);
    },
    onError: (error) => toast.error(error.message),
  });
}
export const splitTags = (value) =>
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
export const dateTime = (value) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
  }).format(new Date(value));
