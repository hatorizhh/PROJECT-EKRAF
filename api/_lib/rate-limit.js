'use strict';

/**
 * Pembatas percobaan login sederhana (in-memory per instance function).
 * Cukup untuk menahan brute force; bukan pengganti WAF terdistribusi.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const MAX_BUCKETS = 5000;
const buckets = new Map();
let lastSweep = 0;

function sweep(now) {
  if (now - lastSweep < 60 * 1000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.start > WINDOW_MS) buckets.delete(key);
  }
  if (buckets.size > MAX_BUCKETS) {
    const trim = buckets.size - MAX_BUCKETS;
    let removed = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (++removed >= trim) break;
    }
  }
}

function hit(key) {
  const now = Date.now();
  sweep(now);
  const id = String(key || 'unknown');
  const bucket = buckets.get(id);

  if (!bucket || now - bucket.start > WINDOW_MS) {
    buckets.set(id, { count: 1, start: now });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  bucket.count += 1;
  if (bucket.count > MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((bucket.start + WINDOW_MS - now) / 1000))
    };
  }
  return { allowed: true, remaining: MAX_ATTEMPTS - bucket.count };
}

function reset(key) {
  buckets.delete(String(key || 'unknown'));
}

module.exports = { hit, reset, MAX_ATTEMPTS, WINDOW_MS };
