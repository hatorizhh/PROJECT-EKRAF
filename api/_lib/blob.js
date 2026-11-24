'use strict';

/**
 * Pembungkus tipis Vercel Blob untuk menyimpan katalog sebagai satu
 * dokumen JSON. Token dibaca dari environment (`BLOB_READ_WRITE_TOKEN`),
 * tidak pernah dari kode atau klien.
 */

const { get, put } = require('@vercel/blob');

function hasStore() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)
  );
}

/** Baca teks blob; null bila blob belum ada. Error lain dilempar ke pemanggil. */
async function readText(pathname) {
  if (!hasStore()) return null;
  const result = await get(pathname, { access: 'public', useCache: false });
  if (!result || !result.stream) return null;
  return new Response(result.stream).text();
}

async function writeText(pathname, text) {
  if (!hasStore()) {
    throw Object.assign(new Error('blob store not configured'), { code: 'STORAGE_NOT_CONFIGURED' });
  }
  return put(pathname, text, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60
  });
}

module.exports = { hasStore, readText, writeText };
