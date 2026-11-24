'use strict';

/**
 * GET  /api/products  → katalog publik (semua pengunjung)
 * POST /api/products  → ubah katalog, khusus admin yang sudah login
 *
 * Body POST: { action: 'create', product: {...} }
 *            { action: 'delete', id: 'atk-...' }
 *            { action: 'reset' }
 */

const { currentUser, isSameOrigin, readJsonBody, sendJson } = require('./_lib/auth');
const catalog = require('./_lib/catalog');

const NO_STORE = { 'Cache-Control': 'no-store' };

function storageError(res, err) {
  const code = err && err.code;
  if (code === 'STORAGE_NOT_CONFIGURED') {
    console.error('Katalog: BLOB_READ_WRITE_TOKEN belum diset');
    return sendJson(res, 503, { error: 'storage_not_configured' });
  }
  console.error('Katalog: gagal mengakses penyimpanan', err && err.message);
  return sendJson(res, 503, { error: 'storage_unavailable' });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', NO_STORE['Cache-Control']);

  if (req.method === 'GET' || req.method === 'HEAD') {
    try {
      const { products, updatedAt, source } = await catalog.readCatalog();
      return sendJson(res, 200, { products, updatedAt, source });
    } catch (err) {
      return storageError(res, err);
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'forbidden_origin' });
  }
  if (!currentUser(req)) {
    return sendJson(res, 401, { error: 'unauthorized' });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    return sendJson(res, err.status || 400, { error: 'invalid_request' });
  }

  const action = body && body.action;

  try {
    if (action === 'create') {
      const result = await catalog.addProduct(body.product);
      return sendJson(res, 201, {
        products: result.products,
        updatedAt: result.updatedAt,
        created: result.product.id
      });
    }

    if (action === 'delete') {
      const result = await catalog.deleteProduct(body.id);
      return sendJson(res, 200, { products: result.products, updatedAt: result.updatedAt });
    }

    if (action === 'reset') {
      const result = await catalog.resetCatalog();
      return sendJson(res, 200, { products: result.products, updatedAt: result.updatedAt });
    }

    return sendJson(res, 400, { error: 'unknown_action' });
  } catch (err) {
    if (err && err.code === 'INVALID_PRODUCT') {
      return sendJson(res, 400, {
        error: 'invalid_product',
        message: 'Nama minimal 3 karakter dan harga minimal Rp 100.'
      });
    }
    if (err && err.code === 'NOT_FOUND') {
      return sendJson(res, 404, { error: 'not_found', message: 'Produk sudah tidak ada di katalog.' });
    }
    if (err && err.code === 'CATALOG_FULL') {
      return sendJson(res, 409, { error: 'catalog_full', message: 'Jumlah produk sudah mencapai batas.' });
    }
    if (err && err.status) {
      return sendJson(res, err.status, { error: 'invalid_request' });
    }
    return storageError(res, err);
  }
};
