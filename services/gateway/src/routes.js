// Keep legacy public URLs stable while routing each domain to its owner.
function targetFor(pathname) {
  if (pathname.startsWith('/study-socket.io') || /^\/api\/v1\/study(\/|$)/.test(pathname))
    return 'study';
  if (/^\/api\/v1\/learning(\/|$)/.test(pathname)) return 'learning';
  if (/^\/api\/v1\/documents(\/|$)/.test(pathname)) return 'content';
  if (/^\/api\/v1\/academic(\/|$)/.test(pathname)) return 'content';
  if (pathname.startsWith('/internal')) return null;
  if (pathname.startsWith('/coding-socket') || /^\/api\/v1\/coding(\/|$)/.test(pathname))
    return 'coding';
  if (pathname.startsWith('/quiz-socket') || /^\/api\/v1\/quiz(\/|$)/.test(pathname)) return 'quiz';
  if (
    pathname.startsWith('/socket.io') ||
    /^\/api\/v1\/(chats|messages)(\/|$)/.test(pathname) ||
    /^\/api\/v1\/users\/notifications(\/|$)/.test(pathname)
  )
    return 'messaging';
  if (
    pathname.startsWith('/uploads/') ||
    /^\/api\/v1\/posts(\/|$)/.test(pathname) ||
    /^\/api\/v1\/users\/getProfile\/[^/]+\/(photos|posts)$/.test(pathname)
  )
    return 'content';
  if (/^\/api\/v1\/(users|friends)(\/|$)/.test(pathname)) return 'accounts';
  return null;
}
module.exports = { targetFor };
