function originOf(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function verificationUrl(req, token) {
  const publicOrigin = originOf(process.env.PUBLIC_APP_URL);
  const frontendOrigin = originOf(process.env.FRONTEND_URL);
  const allowed = new Set(
    [
      publicOrigin,
      frontendOrigin,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      ...(process.env.CORS_ORIGINS || '').split(',').map(originOf),
    ].filter(Boolean)
  );
  const requestedOrigin = originOf(req.headers?.origin);
  // Match the browser's origin so its registration cookie remains available on activation.
  // Only configured application origins are accepted; Host/forwarded headers are not used.
  const origin = allowed.has(requestedOrigin)
    ? requestedOrigin
    : publicOrigin || frontendOrigin || 'http://localhost:3000';
  return `${origin}/activate/${encodeURIComponent(token)}`;
}

module.exports = verificationUrl;
