const { request } = require('@ptitsocial/service-kit/http');

class AcademicNotificationClient {
  constructor({ sender, recipient, questionId, questionTitle, sourceId }) {
    this.payload = {
      sender: Object.fromEntries(
        ['_id', 'first_name', 'last_name', 'photo'].map((key) => [key, sender[key]])
      ),
      recipient: { _id: recipient._id },
      questionId,
      questionTitle,
      sourceId,
    };
  }
  async dispatch(action) {
    const kind = action === 'sendAcademicAnswer' ? 'answer' : 'comment';
    const response = await request('messaging', '/internal/academic-notifications', {
      method: 'POST',
      body: { kind, payload: this.payload },
    });
    return response.notification;
  }
  sendAcademicAnswer() {
    return this.dispatch('sendAcademicAnswer');
  }
  sendAcademicComment() {
    return this.dispatch('sendAcademicComment');
  }
}
module.exports = AcademicNotificationClient;
