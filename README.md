# RANS Fotocopy

Website single-page untuk toko ATK, jasa fotocopy, dan studio cetak foto RANS Fotocopy.
Katalog produk, kalkulator jasa, keranjang + checkout WhatsApp, serta dashboard admin.

- `index.html` — seluruh halaman (HTML, Tailwind, dan JavaScript inline).
- `api/` — Vercel Functions: login/logout/session admin dan API katalog produk. Kredensial tidak ada di kode klien.

## Deploy ke Vercel

1. Import repo ini di Vercel (framework preset: **Other**, tanpa build command, output directory default).
2. Buka **Settings → Environment Variables**, tambahkan untuk Production & Preview:

   | Nama | Nilai |
   | --- | --- |
   | `ADMIN_USERNAME` | username admin pilihan Anda (mis. `admin`) |
   | `ADMIN_PASSWORD` | password kuat, minimal 16 karakter acak |
   | `ADMIN_SESSION_SECRET` | string acak minimal 32 karakter |

   Buat nilai acak dengan `openssl rand -base64 48`.
3. Redeploy. Login admin hanya berfungsi bila ketiga variabel terisi; kalau belum, halaman
   menampilkan "Login belum dikonfigurasi di server".

Jangan menaruh nilai variabel di file mana pun di repo. `.env*` sudah diabaikan `.gitignore`.

## Keamanan yang diterapkan

- Password hanya dibandingkan di server (Vercel Function), memakai perbandingan waktu-konstan.
- Sesi berupa cookie `HttpOnly`, `Secure`, `SameSite=Strict`, ditandatangani HMAC-SHA256, berlaku 8 jam.
- Login dibatasi 8 percobaan per 10 menit per IP (in-memory per instance).
- Endpoint `POST` wajib same-origin, request lintas-origin ditolak (403), tanpa header CORS.
- `vercel.json` mengirim CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy.
- Respons API `Cache-Control: no-store`.

## Penyimpanan katalog produk

Katalog disimpan di **Vercel Blob** sebagai `catalog/products.json`, bukan di browser.
Dashboard admin mengubah data di server lewat `POST /api/products`, jadi perubahan
langsung berlaku untuk semua pengunjung.

1. Buka **Storage** di dashboard Vercel, buat **Blob** store dengan akses *public*,
lalu hubungkan ke project ini. Vercel menambahkan `BLOB_READ_WRITE_TOKEN` secara
otomatis ke Production, Preview, dan Development.
2. Redeploy. Tanpa token tersebut `GET /api/products` menjawab `503`, dan situs
menampilkan katalog dari cache perangkat pengunjung.

`GET /api/products` bersifat publik. Perubahan hanya diterima lewat `POST` dengan
sesi admin valid (cookie HttpOnly) dan wajib same-origin. Bila blob belum pernah
ditulis, katalog bawaan (18 produk) dipakai tanpa menulis apa pun.

Sebelum dipakai produksi, ganti `WA_NUMBER` di bagian atas `<script>` pada `index.html`
dengan nomor WhatsApp toko (format `62…`).
