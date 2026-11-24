'use strict';

const {
  config,
  verifyCredentials,
  createSession,
  sessionCookie,
  isSameOrigin,
  readJsonBody,
  clientIp,
  sendJson
} = require('./_lib/auth');
const { hit, reset } = require('./_lib/rate-limit');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }
  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'forbidden_origin' });
  }
  if (!config().ready) {
    return sendJson(res, 500, { error: 'server_not_configured' });
  }

  const ip = clientIp(req);
  const limit = hit(ip);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return sendJson(res, 429, { error: 'too_many_attempts' });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    return sendJson(res, err.status || 400, { error: 'invalid_request' });
  }

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!username || !password || username.length > 64 || password.length > 256) {
    return sendJson(res, 401, { error: 'invalid_credentials' });
  }

  if (!verifyCredentials(username, password)) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return sendJson(res, 401, { error: 'invalid_credentials' });
  }

  reset(ip);
  res.setHeader('Set-Cookie', sessionCookie(req, createSession(username)));
  return sendJson(res, 200, { ok: true, user: username });
};
