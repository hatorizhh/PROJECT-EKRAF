'use strict';

/**
 * Katalog produk yang tersimpan di server (Vercel Blob), sehingga
 * perubahan dari dashboard admin berlaku untuk semua pengunjung.
 *
 * Satu dokumen JSON: { version, updatedAt, products: [...] }.
 * Bila dokumen belum ada, katalog bawaan dipakai dan tidak ditulis
 * sampai admin menyimpan perubahan pertama.
 */

const crypto = require('node:crypto');
const { readText, writeText } = require('./blob');

const CATALOG_PATHNAME = 'catalog/products.json';
const CATALOG_VERSION = 1;
const MAX_PRODUCTS = 300;

const CATEGORY_IDS = ['kertas', 'pulpen', 'perlengkapan', 'hadiah'];
const ICON_IDS = [
  'notebook',
  'file-text',
  'pen-line',
  'pencil',
  'ruler',
  'gift',
  'scissors',
  'box',
  'backpack',
  'palette',
  'sticky-note',
  'calculator',
  'highlighter',
  'eraser',
  'folder'
];

const DEFAULT_PRODUCTS = [
  { id: 'atk-01', name: 'Kertas HVS A4 70gsm', category: 'kertas', price: 52000, unit: '1 Rim', badge: 'Terlaris', icon: 'file-text', desc: '500 lembar, hasil cetak bersih untuk tugas & fotocopy.' },
  { id: 'atk-02', name: 'Kertas HVS F4 70gsm', category: 'kertas', price: 55000, unit: '1 Rim', badge: '', icon: 'file-text', desc: 'Ukuran folio, favorit untuk soal ujian sekolah.' },
  { id: 'atk-03', name: 'Buku Tulis Campus 38 Lembar', category: 'kertas', price: 5500, unit: 'Pcs', badge: '', icon: 'notebook', desc: 'Kertas tebal, isi 38 lembar bergaris.' },
  { id: 'atk-04', name: 'Buku Gambar A3', category: 'kertas', price: 8500, unit: 'Pcs', badge: 'Produk Baru', icon: 'notebook', desc: 'Cocok untuk tugas seni & lomba mewarnai.' },
  { id: 'atk-05', name: 'Pulpen Standard AE7 Hitam', category: 'pulpen', price: 3500, unit: 'Pcs', badge: 'Terlaris', icon: 'pen-line', desc: 'Tinta lancar, tulisan tebal, tahan lama.' },
  { id: 'atk-06', name: 'Pensil 2B Faber-Castell', category: 'pulpen', price: 4500, unit: 'Pcs', badge: '', icon: 'pencil', desc: 'Standar ujian komputer, grafit hitam pekat.' },
  { id: 'atk-07', name: 'Pulpen Gel 0.5 Hitam', category: 'pulpen', price: 5000, unit: 'Pcs', badge: '', icon: 'pen-line', desc: 'Tinta gel cepat kering, nyaman untuk mencatat.' },
  { id: 'atk-08', name: 'Spidol Snowman Hitam', category: 'pulpen', price: 6000, unit: 'Pcs', badge: '', icon: 'highlighter', desc: 'Untuk papan tulis & menandai catatan.' },
  { id: 'atk-09', name: 'Penghapus Joyko', category: 'perlengkapan', price: 2500, unit: 'Pcs', badge: '', icon: 'eraser', desc: 'Lembut, tidak merusak kertas.' },
  { id: 'atk-10', name: 'Penggaris Besi 30 cm', category: 'perlengkapan', price: 7000, unit: 'Pcs', badge: '', icon: 'ruler', desc: 'Awet, angka jelas, untuk tugas teknik.' },
  { id: 'atk-11', name: 'Map Plastik Snelhecter', category: 'perlengkapan', price: 4000, unit: 'Pcs', badge: '', icon: 'folder', desc: 'Warna acak, kuat untuk berkas sekolahan.' },
  { id: 'atk-12', name: 'Gunting Kertas Sedang', category: 'perlengkapan', price: 9000, unit: 'Pcs', badge: '', icon: 'scissors', desc: 'Pegangan nyaman untuk prakarya.' },
  { id: 'atk-13', name: 'Lem Kertas Glue Stick', category: 'perlengkapan', price: 6500, unit: 'Pcs', badge: '', icon: 'box', desc: 'Bersih, tidak menggumpal, aman untuk anak.' },
  { id: 'atk-14', name: 'Kotak Pensil Karakter', category: 'perlengkapan', price: 15000, unit: 'Pcs', badge: 'Hemat', icon: 'backpack', desc: 'Muatan besar, motif favorit pelajar.' },
  { id: 'atk-15', name: 'Paket Hadiah Juara Lomba', category: 'hadiah', price: 25000, unit: 'Set Paket', badge: 'Terlaris', icon: 'gift', desc: 'Buku, pulpen, pensil, penggaris + tas kecil.' },
  { id: 'atk-16', name: 'Paket Perlengkapan Ujian SD', category: 'hadiah', price: 30000, unit: 'Set Paket', badge: '', icon: 'backpack', desc: 'Pensil 2B, penghapus, rautan & papan ujian.' },
  { id: 'atk-17', name: 'Paket Hadiah Siswa Berprestasi', category: 'hadiah', price: 45000, unit: 'Set Paket', badge: 'Produk Baru', icon: 'gift', desc: 'Buku hardcover, alat tulis premium & piagam.' },
  { id: 'atk-18', name: 'Paket ATK Panitia Lomba (10 Siswa)', category: 'hadiah', price: 185000, unit: 'Set Paket', badge: 'Hemat', icon: 'box', desc: 'Hemat untuk panitia: 10 set hadiah siap bagi.' }
];

function text(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Validasi + normalisasi satu produk dari input klien. */
function normalizeProduct(input, forcedId) {
  if (!input || typeof input !== 'object') return null;

  const name = text(input.name, 80);
  if (name.length < 3) return null;

  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 100 || price > 100000000) return null;

  const category = CATEGORY_IDS.includes(input.category) ? input.category : CATEGORY_IDS[0];
  const icon = ICON_IDS.includes(input.icon) ? input.icon : 'box';

  return {
    id: forcedId || 'atk-' + crypto.randomUUID().slice(0, 8),
    name,
    category,
    price: Math.round(price),
    unit: text(input.unit, 24) || 'Pcs',
    badge: text(input.badge, 24),
    icon,
    desc: text(input.desc, 160)
  };
}

function normalizeList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const product = normalizeProduct(raw, raw && typeof raw.id === 'string' ? raw.id.slice(0, 40) : undefined);
    if (!product || seen.has(product.id)) continue;
    seen.add(product.id);
    out.push(product);
    if (out.length >= MAX_PRODUCTS) break;
  }
  return out;
}

/**
 * @returns {Promise<{products: Array, updatedAt: string|null, source: 'blob'|'defaults'}>}
 */
async function readCatalog() {
  const raw = await readText(CATALOG_PATHNAME);
  if (!raw) {
    return { products: DEFAULT_PRODUCTS.map((p) => ({ ...p })), updatedAt: null, source: 'defaults' };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { products: DEFAULT_PRODUCTS.map((p) => ({ ...p })), updatedAt: null, source: 'defaults' };
  }

  const products = normalizeList(data && data.products);
  return {
    products,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    source: 'blob'
  };
}

async function writeCatalog(products) {
  const payload = {
    version: CATALOG_VERSION,
    updatedAt: new Date().toISOString(),
    products: normalizeList(products)
  };
  await writeText(CATALOG_PATHNAME, JSON.stringify(payload));
  return { products: payload.products, updatedAt: payload.updatedAt };
}

async function addProduct(input) {
  const current = await readCatalog();
  const product = normalizeProduct(input);
  if (!product) {
    throw Object.assign(new Error('invalid product'), { code: 'INVALID_PRODUCT' });
  }
  if (current.products.length >= MAX_PRODUCTS) {
    throw Object.assign(new Error('catalog full'), { code: 'CATALOG_FULL' });
  }
  const saved = await writeCatalog([product, ...current.products]);
  return { product, ...saved };
}

async function deleteProduct(id) {
  const target = typeof id === 'string' ? id.slice(0, 40) : '';
  if (!target) {
    throw Object.assign(new Error('invalid id'), { code: 'INVALID_PRODUCT' });
  }
  const current = await readCatalog();
  const next = current.products.filter((p) => p.id !== target);
  if (next.length === current.products.length) {
    throw Object.assign(new Error('not found'), { code: 'NOT_FOUND' });
  }
  return writeCatalog(next);
}

async function resetCatalog() {
  return writeCatalog(DEFAULT_PRODUCTS);
}

module.exports = {
  CATALOG_PATHNAME,
  DEFAULT_PRODUCTS,
  readCatalog,
  writeCatalog,
  addProduct,
  deleteProduct,
  resetCatalog,
  normalizeProduct
};
