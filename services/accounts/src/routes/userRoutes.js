const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
const { createRateLimiter } = require('@ptitsocial/service-kit/security');

const router = express.Router();

const authenticationLimiter = createRateLimiter({
  max: 15,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = req.body?.email || req.query.email;
    return (
      req.ip +
      ':' +
      (typeof email === 'string' ? email.trim().toLowerCase().slice(0, 100) : 'unknown')
    );
  },
  message: 'Too many authentication attempts. Please wait before trying again.',
});

router.post('/signup', authenticationLimiter, authController.signup);
router.post('/login', authenticationLimiter, authController.login);
router.post('/logout', authController.logOut);
router
  .route('/forgotPassword')
  .all(authenticationLimiter)
  .get(authController.findUser)
  .post(authController.forgotPassword);

router
  .route('/resetPassword')
  .all(authenticationLimiter)
  .post(authController.validateResetCode)
  .patch(authController.resetPassword);

// PROTECT ALL ROUTES AFTER THIS MIDDLEWARE
router.use(authController.protect);

router.put('/ping', authController.ping);
router.post('/emailVerification', authController.activateAccount);
router.post('/resendEmailVerifivation', authController.resendEmailVerification);

router.use(authController.requireVerified);

router.get('/getProfile/:username', userController.getProfile);
router.put('/update/profile/details', userController.updateDetails);
router.post(
  '/update/profile/photo',
  userController.uploadUserPhoto,
  userController.resizeUserPhoto,
  userController.updatePhoto
);
router.post(
  '/update/profile/cover',
  userController.uploadUserPhoto,
  userController.resizeUserCover,
  userController.updateCover
);

router.get('/search', userController.getSearchHistory);
router.post('/search', userController.searchUsers);
router.post('/search/add', userController.addToSearchHistory);
router.post('/search/remove', userController.removeFromSearch);
router.post('/fcm', userController.addFCM);

module.exports = router;
