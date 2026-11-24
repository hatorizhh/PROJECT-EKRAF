'use strict';

const { clearSessionCookie, isSameOrigin, sendJson } = require('./_lib/auth');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }
  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'forbidden_origin' });
  }
  res.setHeader('Set-Cookie', clearSessionCookie(req));
  return sendJson(res, 200, { ok: true });
};
