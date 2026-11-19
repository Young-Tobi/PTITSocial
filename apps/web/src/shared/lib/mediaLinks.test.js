import { mediaLink, normalizeMediaLinks } from './mediaLinks';

test('old local media loads through the website without rewriting external images', () => {
  const prefix = process.env.REACT_APP_BACKEND_URL || '';
  expect(mediaLink('http://localhost:8000/uploads/BACKBOOK/test.webp')).toBe(
    prefix + '/uploads/BACKBOOK/test.webp'
  );
  expect(mediaLink('http://localhost:8000/api/v1/messages/files/example')).toBe(
    prefix + '/api/v1/messages/files/example'
  );
  expect(mediaLink('http://localhost:8000/api/v1/messages/media/example')).toBe(
    prefix + '/api/v1/messages/media/example'
  );
  expect(mediaLink('http://127.0.0.1:3000/images/default_pic.png')).toBe('/images/default_pic.png');
  expect(mediaLink('https://example.com/uploads/test.webp')).toBe(
    'https://example.com/uploads/test.webp'
  );
  expect(mediaLink('http://localhost:3000/activate/token')).toBe(
    'http://localhost:3000/activate/token'
  );
  expect(mediaLink(null)).toBe(null);
});

test('HTTP and socket data normalize nested media while preserving post text and source code', () => {
  const old = 'http://localhost:8000/uploads/test.webp';
  const data = {
    text: old,
    source: old,
    user: { photo: 'http://localhost:3000/images/default_pic.png' },
    images: [old],
    resources: [{ secure_url: old }],
    message: { type: 'image', content: old },
  };
  expect(normalizeMediaLinks(data)).toBe(data);
  expect(data.user.photo).toBe('/images/default_pic.png');
  expect(data.images[0]).toBe((process.env.REACT_APP_BACKEND_URL || '') + '/uploads/test.webp');
  expect(data.resources[0].secure_url).toBe(data.images[0]);
  expect(data.message.content).toBe(data.images[0]);
  expect(data.text).toBe(old);
  expect(data.source).toBe(old);
});
