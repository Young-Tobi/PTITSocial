const express = require('express');
const controller = require('../controllers/studySpotController');

const router = express.Router();
router.get('/locations', controller.listLocations);
router.get('/locations/nearby', controller.nearbyFromPoint);
router.get('/locations/:locationId/nearby', controller.nearbyLocations);
router.get('/locations/:locationId', controller.getLocation);
router.put('/locations/:locationId/review', controller.upsertReview);
router.delete('/reviews/:reviewId', controller.deleteReview);
router.post('/meetups', controller.createMeetup);
router.get('/meetups/mine', controller.myMeetups);
router.post('/meetups/:meetupId/request', controller.requestMeetup);
router.patch('/registrations/:registrationId/decision', controller.decideRegistration);
router.patch('/registrations/:registrationId/cancel', controller.cancelRegistration);
router.patch('/meetups/:meetupId/cancel', controller.cancelMeetup);
module.exports = router;
