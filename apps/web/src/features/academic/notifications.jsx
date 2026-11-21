import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { queryClient } from 'App';
import { reciveNoti } from 'app/slices/userSlice';
import { useSeenNotification } from 'features/notifications/hooks/useSeenNotification';
import sound from 'assets/notification_sweet.wav';
import { dateTime } from './api';
import styles from './notifications.module.css';

function AcademicToast({ notification, t }) {
  const navigate = useNavigate();
  const { mutate: markSeen } = useSeenNotification();
  return (
    <section className={styles.toast} aria-label="Thông báo hỏi đáp">
      <div className={styles.header}>
        <strong>Thông báo mới</strong>
        <button onClick={() => toast.dismiss(t.id)} aria-label="Đóng thông báo">
          ×
        </button>
      </div>
      <button
        className={styles.content}
        onClick={() => {
          markSeen({ nid: notification._id });
          toast.dismiss(t.id);
          navigate(notification.click);
        }}
      >
        <img src={notification.sender?.photo} alt="" />
        <span>
          {notification.content}
          <small>{dateTime(notification.createdAt)}</small>
        </span>
      </button>
    </section>
  );
}
export function registerAcademicNotifications(socket, dispatch) {
  socket.on('academic_notification', ({ notification }) => {
    if (!notification?.click?.startsWith('/questions/')) return;
    new Audio(sound).play().catch(() => {});
    dispatch(reciveNoti({ type: 'notification' }));
    toast.custom((t) => <AcademicToast notification={notification} t={t} />);
    queryClient.invalidateQueries({ queryKey: ['academic'] });
    queryClient.setQueryData(['getNotifications'], (old) =>
      old
        ? {
            ...old,
            data: {
              ...old.data,
              notifications: [
                notification,
                ...old.data.notifications.filter((item) => item._id !== notification._id),
              ],
            },
          }
        : old
    );
  });
}
