'use strict';

const { currentUser, sendJson } = require('./_lib/auth');

module.exports = function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }
  const user = currentUser(req);
  return sendJson(res, 200, user ? { authenticated: true, user } : { authenticated: false });
};
