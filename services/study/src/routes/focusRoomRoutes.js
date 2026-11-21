const express = require('express');
const controller = require('../controllers/focusRoomController');
const { createRateLimiter } = require('@ptitsocial/service-kit/security');

const router = express.Router();
const joinLimiter = createRateLimiter({
  max: 20,
  message: 'Too many room join attempts. Please try again later.',
});
router.route('/').get(controller.listRooms).post(controller.createRoom);
router.post('/:roomId/join', joinLimiter, controller.joinRoom);
router.get('/:roomId', controller.getRoom);
router.post('/:roomId/leave', controller.leaveRoom);
router.post('/:roomId/livekit-token', controller.createLiveKitToken);
module.exports = router;
