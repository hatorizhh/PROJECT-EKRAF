# RANS Fotocopy

Website single-page untuk toko ATK, jasa fotocopy, dan studio cetak foto RANS Fotocopy.
Katalog produk, kalkulator jasa, keranjang + checkout WhatsApp, serta dashboard admin.

- `index.html` — seluruh halaman (HTML, Tailwind, dan JavaScript inline).
- `api/` — Vercel Functions untuk login/logout/session admin. Kredensial tidak ada di kode klien.

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

## Catatan penting

Dashboard admin mengubah katalog yang tersimpan di `localStorage` **perangkat pengunjung**,
bukan di server. Jadi perubahan produk hanya terlihat di browser tempat admin mengeditnya.
Agar katalog berlaku untuk semua pengunjung, produk perlu disimpan di database
(mis. Vercel Postgres/KV atau Upstash) — belum termasuk dalam versi ini.

Sebelum dipakai produksi, ganti `WA_NUMBER` di bagian atas `<script>` pada `index.html`
dengan nomor WhatsApp toko (format `62…`).
