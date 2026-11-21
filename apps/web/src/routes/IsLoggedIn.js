import { registerAcademicNotifications } from 'features/academic/notifications';
import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Navigate, Outlet } from 'react-router-dom';
import Header from 'features/navigation/components/header/Header';
import Loading from 'shared/components/ui/Loading/Loading';
import VerificationRequired from 'features/auth/components/activation/VerificationRequired';
import { io } from 'socket.io-client';
import { queryClient } from 'App';
import chat_notification from 'assets/chat_notification.wav';
import notification_sweet from 'assets/notification_sweet.wav';
import { setOnlineUsers } from 'app/slices/socketSlice';
import { toast } from 'react-hot-toast';
import Notification from 'shared/components/ui/Notification/Notification';
import { reciveNoti, updateNStats } from 'app/slices/userSlice';
import { normalizeMediaLinks } from 'shared/lib/mediaLinks';
import {
  updateChatName,
  updateChatTheme,
  updateMessages,
  updateSeenMessages,
} from 'shared/lib/rqUpdate';

export let socket;

function playNotificationSound() {
  const audio = new Audio(chat_notification);
  audio.play().catch(() => {
    // Notifications still work when the browser blocks autoplay.
  });
}

function playNotificationSound2() {
  const audio = new Audio(notification_sweet);
  audio.play().catch(() => {
    // Notifications still work when the browser blocks autoplay.
  });
}

export default function IsLoggedIn({ user }) {
  const dispatch = useDispatch();

  const msgNoti = (newMessage) => {
    const res = window.location.pathname.split('/').pop() !== newMessage.chat;
    return res;
  };

  useEffect(() => {
    if (user.userinfo?.verified) {
      socket = io(process.env.REACT_APP_BACKEND_URL || window.location.origin, {
        withCredentials: true,
      });
      socket.onAny((event, ...args) => args.forEach(normalizeMediaLinks));
      registerAcademicNotifications(socket, dispatch);
      socket.on('connect', () => {
        socket.emit('setup', {});
        queryClient.invalidateQueries({ queryKey: ['getFriendsPage'] });
      });
      socket.on('disconnect', () => dispatch(setOnlineUsers({ type: 'connect', info: [] })));

      socket.on('online_user', ({ type, info }) => {
        dispatch(setOnlineUsers({ type, info }));
      });

      socket.on('new_notification', ({ notification }) => {
        if (notification.type === 'friend') {
          queryClient.invalidateQueries({ queryKey: ['getFriendsPage'] });
        }
        playNotificationSound2();
        dispatch(
          reciveNoti({
            type: 'notification',
          })
        );

        toast.custom((t) => <Notification t={t} toast={toast} notification={notification} />);

        queryClient.setQueryData(['getNotifications'], (oldData) => {
          if (!oldData) return oldData;
          let newData = oldData;
          newData.data.notifications = [notification, ...newData.data.notifications];
          return {
            ...oldData,
            newData,
          };
        });
      });

      socket.on('message_recieved', (newMessage, stats) => {
        playNotificationSound();
        if (stats) dispatch(updateNStats(stats));
        if (msgNoti(newMessage)) {
          toast.custom((t) => (
            <Notification
              t={t}
              toast={toast}
              notification={{
                sender: newMessage.sender,
                type: 'message',
                click: `/messages/${newMessage.chat}`,
                content: `${newMessage.sender.first_name} ${newMessage.sender.last_name} sent you a message`,
                createdAt: newMessage.createdAt,
              }}
            />
          ));
        }
        updateMessages(newMessage);
      });

      socket.on('customize_chat', ({ type, content, chat }) => {
        if (type === 'theme') {
          updateChatTheme(content, chat);
        }
        if (type === 'name') {
          updateChatName(content, chat);
        }
      });

      socket.on('seen', ({ message: newMessage, chat }) => {
        updateSeenMessages(newMessage, chat);
      });
      return () => socket.disconnect();
    }
  }, [dispatch, user.userinfo?._id, user.userinfo?.verified]);

  if (user.userinfo && !user.userinfo.verified) {
    return <VerificationRequired />;
  }

  return user.userinfo ? (
    <>
      <Header />
      <React.Suspense fallback={<Loading />}>
        <Outlet />
      </React.Suspense>
    </>
  ) : (
    <Navigate to="/login" />
  );
}
