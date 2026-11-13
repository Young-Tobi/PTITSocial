const AppError = require('./appError');

const serviceUrls = {
  accounts: () => process.env.ACCOUNTS_URL,
  content: () => process.env.CONTENT_URL,
  messaging: () => process.env.MESSAGING_URL,
};

async function request(service, pathname, options = {}) {
  const base = serviceUrls[service]?.();
  if (!base) throw new Error(`Missing URL for service: ${service}`);
  let response;
  try {
    response = await fetch(new URL(pathname, base), {
      method: options.method || 'GET',
      headers: {
        'content-type': 'application/json',
        'x-service-key': process.env.INTERNAL_API_KEY,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(5000),
    });
  } catch (cause) {
    throw new AppError(`${service} service is unavailable`, 503);
  }
  const body = await response.json();
  if (!response.ok)
    throw new AppError(body.message || `${service} request failed`, response.status);
  return body;
}

function internalOnly(req, res, next) {
  if (!process.env.INTERNAL_API_KEY || req.get('x-service-key') !== process.env.INTERNAL_API_KEY) {
    return res.status(403).json({ status: 'fail', message: 'Internal service access required' });
  }
  next();
}

module.exports = { request, internalOnly };
