// Older records contain absolute localhost image URLs. Keep the records intact,
// but load their images through the same origin as the website.
export function mediaLink(value) {
  if (typeof value !== 'string') return value;
  const match = value.match(/^https?:\/\/(?:localhost|127\.0\.0\.1):(?:8000(\/uploads\/[^\s]*)|3000(\/images\/[^\s]*))$/);
  if (!match) return value;
  const path = match[1] || match[2];
  // Default pictures belong to the frontend, even with a separate API origin.
  return path.startsWith('/images/') ? path : (process.env.REACT_APP_BACKEND_URL || '') + path;
}

export function normalizeMediaLinks(data) {
  if (!data || typeof data !== 'object') return data;
  for (const key of Object.keys(data)) {
    if (['photo', 'cover', 'url', 'secure_url'].includes(key) ||
        (key === 'content' && data.type === 'image')) data[key] = mediaLink(data[key]);
    else if (key === 'images' && Array.isArray(data[key])) data[key] = data[key].map(mediaLink);
    else normalizeMediaLinks(data[key]);
  }
  return data;
}
