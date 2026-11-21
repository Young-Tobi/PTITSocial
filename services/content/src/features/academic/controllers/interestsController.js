const Interest = require('../models/interestModel');
const catchAsync = require('@ptitsocial/service-kit/catchAsync');
const { interests } = require('../utils/subjects');
exports.get = catchAsync(async (req, res) => {
  const saved = await Interest.findOne({ user: req.user.id }).lean();
  res.json({
    status: 'success',
    data: { subjects: saved?.subjects || [], tags: saved?.tags || [] },
  });
});
exports.update = catchAsync(async (req, res) => {
  const data = interests(req.body);
  await Interest.findOneAndUpdate(
    { user: req.user.id },
    { $set: data },
    {
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );
  res.json({ status: 'success', data });
});
