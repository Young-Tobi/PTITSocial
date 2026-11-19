import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import Cookies from 'js-cookie';
import { quizRequest } from '../api';

export default function useQuizRoom(roomId) {
  const client = useQueryClient();
  const [connected, setConnected] = useState(false);
  const query = useQuery({
    queryKey: ['quiz-room', roomId],
    queryFn: () => quizRequest('GET', `/rooms/${roomId}`),
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (data) => (data?.room.status === 'finished' ? false : 2000),
  });
  useEffect(() => {
    const socket = io(process.env.REACT_APP_BACKEND_URL || window.location.origin, {
      path: '/quiz-socket',
      withCredentials: true,
      auth: { token: JSON.parse(Cookies.get('token') || 'null') },
    });
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('room:subscribe', { roomId });
      client.invalidateQueries(['quiz-room', roomId]);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('room:updated', () => {
      client.invalidateQueries(['quiz-room', roomId]);
      client.invalidateQueries(['quiz-results', roomId]);
    });
    return () => socket.disconnect();
  }, [roomId, client]);
  return { ...query, connected };
}
