import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import Cookies from 'js-cookie';
import { codingRequest } from './api';
export default function useCodingRoom(roomId) {
  const client = useQueryClient();
  const [connected, setConnected] = useState(false);
  const query = useQuery({
    queryKey: ['coding-room', roomId],
    queryFn: () => codingRequest('GET', '/rooms/' + roomId),
    retry: false,
    refetchInterval: (data) => (data?.room.status === 'finished' ? false : 2000),
  });
  useEffect(() => {
    const socket = io(process.env.REACT_APP_BACKEND_URL, {
      path: '/coding-socket',
      withCredentials: true,
      auth: { token: JSON.parse(Cookies.get('token') || 'null') },
    });
    let timer;
    const refresh = () => client.invalidateQueries(['coding-room', roomId]);
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('room:subscribe', { roomId });
      refresh();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('room:updated', () => {
      if (!timer)
        timer = setTimeout(() => {
          timer = null;
          refresh();
        }, 250);
    });
    return () => {
      clearTimeout(timer);
      socket.disconnect();
    };
  }, [roomId, client]);
  return { ...query, connected };
}
