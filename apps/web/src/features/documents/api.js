import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
export const base = process.env.REACT_APP_BACKEND_URL + '/api/v1/documents';
export async function request(path = '', method = 'GET', data) {
  try {
    return (await axios({ url: base + path, method, data, withCredentials: true })).data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message || 'Không thể kết nối kho tài liệu. Vui lòng thử lại.'
    );
  }
}
export const useDocuments = (path) =>
  useQuery({ queryKey: ['documents', path], queryFn: () => request(path), retry: false });
export function useAction(callback) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ path, method = 'POST', data }) => request(path, method, data),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ['documents'] });
      callback?.(result);
    },
    onError: (error) => toast.error(error.message),
  });
}
export const date = (value) =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
