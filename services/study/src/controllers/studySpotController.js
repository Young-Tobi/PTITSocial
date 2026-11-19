const mongoose = require('mongoose');
const AppError = require('@ptitsocial/service-kit/appError');
const catchAsync = require('@ptitsocial/service-kit/catchAsync');
const Location = require('../models/studyLocationModel');
const Review = require('../models/studyLocationReviewModel');
const Meetup = require('../models/studyMeetupModel');
const Registration = require('../models/studyMeetupRegistrationModel');

const publicUser = 'first_name last_name username photo';
const validId = (id) => mongoose.isValidObjectId(id);

exports.listLocations = catchAsync(async (req, res) => {
  const query = { active: true };
  if (req.query.type) query.type = req.query.type;
  if (req.query.wifi === 'true') query.wifi = true;
  if (req.query.power === 'true') query.powerOutlets = true;
  if (req.query.suitableFor) query.suitableFor = req.query.suitableFor;
  if (req.query.q?.trim()) query.$text = { $search: req.query.q.trim().slice(0, 100) };
  const locations = await Location.find(query).sort({ averageRating: -1, name: 1 }).limit(3000);
  res.json({ status: 'success', data: { locations } });
});

exports.nearbyFromPoint = catchAsync(async (req, res, next) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lng);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return next(new AppError('Valid lat and lng coordinates are required', 400));

  const requestedKm = Number(req.query.radiusKm) || 10;
  const radiusMeters = Math.min(Math.max(requestedKm, 1), 50) * 1000;
  const query = { active: true };
  if (['individual', 'group'].includes(req.query.suitableFor))
    query.suitableFor = req.query.suitableFor;
  if (req.query.wifi === 'true') query.wifi = true;
  if (req.query.power === 'true') query.powerOutlets = true;
  if (req.query.type) query.type = req.query.type;

  const locations = await Location.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [longitude, latitude] },
        distanceField: 'distanceMeters',
        maxDistance: radiusMeters,
        spherical: true,
        query,
      },
    },
    { $limit: 40 },
  ]);
  res.json({
    status: 'success',
    data: {
      anchor: { latitude, longitude },
      locations,
      radiusKm: radiusMeters / 1000,
    },
  });
});

exports.nearbyLocations = catchAsync(async (req, res, next) => {
  if (!validId(req.params.locationId)) return next(new AppError('Invalid location id', 400));
  const origin = await Location.findOne({ _id: req.params.locationId, active: true });
  if (!origin) return next(new AppError('Study location not found', 404));

  const requestedKm = Number(req.query.radiusKm) || 10;
  const radiusMeters = Math.min(Math.max(requestedKm, 1), 50) * 1000;
  const suitability = ['individual', 'group'].includes(req.query.suitableFor)
    ? req.query.suitableFor
    : undefined;
  const query = { active: true, _id: { $ne: origin._id } };
  if (suitability) query.suitableFor = suitability;
  if (req.query.wifi === 'true') query.wifi = true;
  if (req.query.power === 'true') query.powerOutlets = true;
  if (req.query.type) query.type = req.query.type;

  const locations = await Location.aggregate([
    {
      $geoNear: {
        near: origin.coordinates,
        distanceField: 'distanceMeters',
        maxDistance: radiusMeters,
        spherical: true,
        query,
      },
    },
    { $limit: 40 },
  ]);
  res.json({ status: 'success', data: { origin, locations, radiusKm: radiusMeters / 1000 } });
});

exports.getLocation = catchAsync(async (req, res, next) => {
  if (!validId(req.params.locationId)) return next(new AppError('Invalid location id', 400));
  const location = await Location.findById(req.params.locationId);
  if (!location || !location.active) return next(new AppError('Study location not found', 404));
  const [reviews, meetups] = await Promise.all([
    Review.find({ location: location.id })
      .populate('user', publicUser)
      .sort({ createdAt: -1 })
      .limit(100),
    Meetup.find({ location: location.id, status: 'scheduled', endsAt: { $gt: new Date() } })
      .populate('organizer', publicUser)
      .sort('startsAt'),
  ]);
  res.json({ status: 'success', data: { location, reviews, meetups } });
});

async function refreshRating(locationId) {
  const [stats] = await Review.aggregate([
    { $match: { location: new mongoose.Types.ObjectId(locationId) } },
    { $group: { _id: '$location', averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
  ]);
  await Location.updateOne(
    { _id: locationId },
    { averageRating: stats?.averageRating || 0, reviewCount: stats?.reviewCount || 0 }
  );
}

exports.upsertReview = catchAsync(async (req, res, next) => {
  const rating = Number(req.body.rating);
  if (!validId(req.params.locationId) || !Number.isInteger(rating) || rating < 1 || rating > 5)
    return next(new AppError('Rating must be an integer from 1 to 5', 400));
  if (!(await Location.exists({ _id: req.params.locationId, active: true })))
    return next(new AppError('Study location not found', 404));
  const review = await Review.findOneAndUpdate(
    { location: req.params.locationId, user: req.user.id },
    { rating, comment: req.body.comment || '' },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  ).populate('user', publicUser);
  await refreshRating(req.params.locationId);
  res.status(201).json({ status: 'success', data: { review } });
});

exports.deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findOneAndDelete({ _id: req.params.reviewId, user: req.user.id });
  if (!review) return next(new AppError('Review not found or not owned by you', 404));
  await refreshRating(review.location);
  res.status(204).end();
});

exports.createMeetup = catchAsync(async (req, res, next) => {
  const startsAt = new Date(req.body.startsAt);
  const endsAt = new Date(req.body.endsAt);
  if (
    !validId(req.body.location) ||
    Number.isNaN(startsAt.valueOf()) ||
    Number.isNaN(endsAt.valueOf())
  )
    return next(new AppError('Valid location and schedule are required', 400));
  if (startsAt <= new Date() || endsAt <= startsAt)
    return next(new AppError('Meetup must start in the future and end after it starts', 400));
  if (!(await Location.exists({ _id: req.body.location, active: true })))
    return next(new AppError('Study location not found', 404));
  const meetup = await Meetup.create({
    title: req.body.title,
    subject: req.body.subject,
    goal: req.body.goal,
    description: req.body.description,
    location: req.body.location,
    organizer: req.user.id,
    startsAt,
    endsAt,
    maxParticipants: req.body.maxParticipants,
  });
  res.status(201).json({ status: 'success', data: { meetup } });
});

exports.requestMeetup = catchAsync(async (req, res, next) => {
  if (!validId(req.params.meetupId)) return next(new AppError('Invalid meetup id', 400));
  const meetup = await Meetup.findOne({
    _id: req.params.meetupId,
    status: 'scheduled',
    endsAt: { $gt: new Date() },
  });
  if (!meetup) return next(new AppError('Meetup is not available', 404));
  if (String(meetup.organizer) === String(req.user.id))
    return next(new AppError('The organizer is already attending', 409));
  const existing = await Registration.findOne({ meetup: meetup.id, user: req.user.id });
  if (existing && !['cancelled', 'rejected'].includes(existing.status))
    return next(new AppError('You already requested this meetup', 409));
  const registration = existing || new Registration({ meetup: meetup.id, user: req.user.id });
  registration.status = 'pending';
  registration.message = req.body.message || '';
  registration.decidedAt = undefined;
  await registration.save();
  res.status(201).json({ status: 'success', data: { registration } });
});

exports.decideRegistration = catchAsync(async (req, res, next) => {
  const status = req.body.status;
  if (!['accepted', 'rejected'].includes(status))
    return next(new AppError('Invalid decision', 400));
  const registration = await Registration.findOne({
    _id: req.params.registrationId,
    status: 'pending',
  });
  if (!registration) return next(new AppError('Pending registration not found', 404));
  const meetup = await Meetup.findOne({
    _id: registration.meetup,
    organizer: req.user.id,
    status: 'scheduled',
  });
  if (!meetup) return next(new AppError('Only the organizer can decide this request', 403));
  if (status === 'accepted') {
    const reserved = await Meetup.findOneAndUpdate(
      {
        _id: meetup.id,
        status: 'scheduled',
        $expr: { $lt: ['$acceptedCount', '$maxParticipants'] },
      },
      { $inc: { acceptedCount: 1 } },
      { new: true }
    );
    if (!reserved) return next(new AppError('Meetup has no remaining registration slots', 409));
  }
  const decided = await Registration.findOneAndUpdate(
    { _id: registration.id, status: 'pending' },
    { status, decidedAt: new Date() },
    { new: true, runValidators: true }
  );
  if (!decided) {
    if (status === 'accepted')
      await Meetup.updateOne(
        { _id: meetup.id, acceptedCount: { $gt: 1 } },
        { $inc: { acceptedCount: -1 } }
      );
    return next(new AppError('This request was already decided', 409));
  }
  res.json({ status: 'success', data: { registration: decided } });
});

exports.cancelRegistration = catchAsync(async (req, res, next) => {
  const registration = await Registration.findOne({
    _id: req.params.registrationId,
    user: req.user.id,
  });
  if (!registration || !['pending', 'accepted'].includes(registration.status))
    return next(new AppError('Active registration not found', 404));
  const wasAccepted = registration.status === 'accepted';
  registration.status = 'cancelled';
  await registration.save();
  if (wasAccepted)
    await Meetup.updateOne(
      { _id: registration.meetup, acceptedCount: { $gt: 1 } },
      { $inc: { acceptedCount: -1 } }
    );
  res.json({ status: 'success', data: { registration } });
});

exports.cancelMeetup = catchAsync(async (req, res, next) => {
  const meetup = await Meetup.findOneAndUpdate(
    { _id: req.params.meetupId, organizer: req.user.id, status: 'scheduled' },
    { status: 'cancelled' },
    { new: true }
  );
  if (!meetup) return next(new AppError('Meetup not found or not owned by you', 404));
  res.json({ status: 'success', data: { meetup } });
});

exports.myMeetups = catchAsync(async (req, res) => {
  const [organized, registrations] = await Promise.all([
    Meetup.find({ organizer: req.user.id })
      .populate('location', 'name address')
      .sort({ startsAt: -1 }),
    Registration.find({ user: req.user.id })
      .populate({
        path: 'meetup',
        populate: [
          { path: 'location', select: 'name address' },
          { path: 'organizer', select: publicUser },
        ],
      })
      .sort({ createdAt: -1 }),
  ]);
  const meetupIds = organized.map((item) => item._id);
  const requests = await Registration.find({ meetup: { $in: meetupIds } })
    .populate('user', publicUser)
    .sort('createdAt');
  res.json({ status: 'success', data: { organized, registrations, requests } });
});
