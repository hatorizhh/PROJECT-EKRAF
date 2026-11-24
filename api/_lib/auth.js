'use strict';

/**
 * Utilitas autentikasi admin untuk Vercel Functions.
 * Kredensial TIDAK pernah ada di kode klien; hanya dibaca dari
 * environment variables di sisi server:
 *   ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SESSION_SECRET (min. 32 karakter).
 */

const crypto = require('node:crypto');

const COOKIE_NAME = 'rans_admin';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const MAX_BODY_BYTES = 2048;

const b64url = (value) => Buffer.from(value).toString('base64url');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest();
}

/** Perbandingan waktu-konstan (panjang input tidak bocor lewat timing). */
function safeEqual(a, b) {
  return crypto.timingSafeEqual(sha256(a), sha256(b));
}

function config() {
  const username = process.env.ADMIN_USERNAME || '';
  const password = process.env.ADMIN_PASSWORD || '';
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  return {
    username,
    password,
    secret,
    ready: Boolean(username && password && secret.length >= 32)
  };
}

function verifyCredentials(username, password) {
  const cfg = config();
  if (!cfg.ready) return false;
  const userOk = safeEqual(username, cfg.username);
  const passOk = safeEqual(password, cfg.password);
  return userOk && passOk;
}

function sign(payload) {
  return crypto.createHmac('sha256', config().secret).update(payload).digest('base64url');
}

function createSession(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ u: user, iat: now, exp: now + SESSION_TTL_SECONDS }));
  return `${payload}.${sign(payload)}`;
}

function verifySession(token) {
  if (!token || typeof token !== 'string' || token.length > 1024) return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(payload);
  if (expected.length !== signature.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!data || typeof data.exp !== 'number' || !data.u) return null;
  if (data.exp < Math.floor(Date.now() / 1000)) return null;
  return { user: String(data.u), expiresAt: data.exp };
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      out[key] = part.slice(idx + 1).trim();
    }
  }
  return out;
}

function isHttps(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return proto === 'https';
}

function sessionCookie(req, token) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${SESSION_TTL_SECONDS}`
  ];
  if (isHttps(req)) parts.push('Secure');
  return parts.join('; ');
}

function clearSessionCookie(req) {
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (isHttps(req)) parts.push('Secure');
  return parts.join('; ');
}

function currentUser(req) {
  const cookies = parseCookies(req.headers.cookie);
  const session = verifySession(cookies[COOKIE_NAME]);
  return session ? session.user : null;
}

/** Tolak request lintas-origin (proteksi CSRF tambahan selain SameSite=Strict). */
function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (origin === 'null') return false;
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || String(req.headers.host || '').trim();
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (forwarded) return forwarded;
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function readStream(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const raw = typeof req.body === 'string' ? req.body : await readStream(req);
  if (raw.length > MAX_BODY_BYTES) {
    throw Object.assign(new Error('body too large'), { status: 413 });
  }
  try {
    return JSON.parse(raw || '{}');
  } catch {
    throw Object.assign(new Error('invalid json'), { status: 400 });
  }
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

module.exports = {
  COOKIE_NAME,
  SESSION_TTL_SECONDS,
  config,
  verifyCredentials,
  createSession,
  verifySession,
  parseCookies,
  sessionCookie,
  clearSessionCookie,
  currentUser,
  isSameOrigin,
  clientIp,
  readJsonBody,
  sendJson
};
