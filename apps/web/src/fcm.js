import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging';

// Optional browser push uses the project's own public Firebase configuration.
let firebaseConfig = null;
try {
  firebaseConfig = JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG || 'null');
} catch {
  console.warn('Cấu hình Firebase không hợp lệ; sử dụng thông báo trong ứng dụng.');
}
export const app =
  process.env.REACT_APP_ENABLE_FIREBASE === 'true' && firebaseConfig?.projectId
    ? initializeApp(firebaseConfig)
    : null;
export const messaging = app ? getMessaging(app) : null;
