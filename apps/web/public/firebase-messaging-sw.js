// Browser push is optional. Configuration is supplied by the owning PTITSocial app.
const config = new URL(self.location.href).searchParams.get('config');
if (config) {
  importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js');
  importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js');
  firebase.initializeApp(JSON.parse(config));
  firebase.messaging().onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    self.registration.showNotification(notification.title || 'PTITSocial', {
      body: notification.body || '',
      icon: '/icons/ptitsocial.svg',
    });
  });
}
