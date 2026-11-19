const { test } = require('node:test');
const assert = require('node:assert/strict');
const { targetFor } = require('../../services/gateway/src/routes');
const Interest = require('../../services/content/src/features/academic/models/interestModel');

test('academic APIs including private interests belong to Content', () => {
  for (const route of ['questions', 'answers', 'subjects', 'interests']) {
    assert.equal(targetFor('/api/v1/academic/' + route), 'content');
  }
  assert.equal(Interest.collection.name, 'academic_interests');
  assert.equal(targetFor('/api/v1/academicOther'), null);
  assert.equal(targetFor('/internal/academic-notifications'), null);
});
