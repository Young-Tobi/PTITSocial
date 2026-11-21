const catchAsync = require('@ptitsocial/service-kit/catchAsync');
const AppError = require('@ptitsocial/service-kit/appError');
const User = require('../../models/userModel');
const Notification = require('./notificationModel');
const { getIO } = require('../../utils/socket');
const validId = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);

module.exports = function registerAcademicNotifications(app, sync) {
  app.post(
    '/internal/academic-notifications',
    catchAsync(async (req, res) => {
      const { kind, payload } = req.body;
      if (
        !['answer', 'comment'].includes(kind) ||
        !payload ||
        ![payload.sender?._id, payload.recipient?._id, payload.questionId, payload.sourceId].every(
          validId
        ) ||
        typeof payload.questionTitle !== 'string' ||
        payload.questionTitle.length > 200
      ) {
        throw new AppError('Invalid academic notification event', 400);
      }
      if (payload.sender._id === payload.recipient._id)
        return res.status(201).json({ notification: null });
      await sync.sync();
      const sender = await User.findById(payload.sender._id);
      if (!sender) throw new AppError('Sender not found', 404);
      const name = [sender.last_name, sender.first_name].filter(Boolean).join(' ');
      await Notification.init();
      let notification;
      try {
        notification = await Notification.create({
          sender: sender._id,
          recipient: payload.recipient._id,
          click: '/questions/' + payload.questionId,
          content:
            kind === 'answer'
              ? `${name} đã trả lời câu hỏi của bạn: “${payload.questionTitle}”.`
              : `${name} đã bình luận trong phần thảo luận của câu hỏi: “${payload.questionTitle}”.`,
          academicKind: kind,
          academicEventKey: `academic_${kind}:${payload.sourceId}:${payload.recipient._id}`,
        });
      } catch (error) {
        if (error.code === 11000) return res.status(201).json({ notification: null });
        throw error;
      }
      await User.updateOne({ _id: payload.recipient._id }, { $inc: { unseenNotification: 1 } });
      await notification.populate('sender', 'first_name last_name photo username');
      const data = notification.toObject();
      delete data.academicEventKey;
      getIO()
        ?.to('user:' + payload.recipient._id)
        .emit('academic_notification', { notification: data });
      res.status(201).json({ notification: data });
    })
  );
};
