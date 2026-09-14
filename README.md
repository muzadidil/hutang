# Buku Hutang

Aplikasi pencatat hutang, jatuh tempo, dan pembayaran. Statis (HTML/CSS/JS
biasa, tanpa build tool), disimpan di Firestore, dan bisa cetak PDF per
catatan hutang maupun laporan lengkap. Dirancang untuk dihosting gratis di
GitHub Pages.

## Fitur

- Catat hutang: kepada siapa, jumlah, tanggal, jatuh tempo, catatan.
- Catat pembayaran (cicilan) per hutang — sisa dan status lunas dihitung otomatis.
- Beranda menampilkan total sisa hutang dan hutang yang mendekati/lewat jatuh tempo.
- Laporan lengkap semua hutang, bisa dicetak/diunduh sebagai PDF.
- Cetak PDF rincian per hutang (mirip nota) berisi riwayat pembayaran.
- Layar masuk berkata sandi (bawaan: `zasha`, diatur di `js/config.js`) — sekadar penghalang tampilan, bukan keamanan data sesungguhnya.
- Login otomatis (anonim) ke Firebase di belakang layar — pengguna tidak perlu tahu soal ini.

## 1. Siapkan project Firebase

1. Buka [Firebase Console](https://console.firebase.google.com) → **Add project** → beri nama bebas, mis. `hutang-saya`.
2. Di sidebar, buka **Build → Firestore Database** → **Create database** → pilih mode **production**, lokasi terserah (mis. `asia-southeast2`).
3. Di sidebar, buka **Build → Authentication** → tab **Sign-in method** → aktifkan provider **Anonymous**. Ini wajib — tanpa ini aplikasi tidak bisa masuk sama sekali.
4. Buka **Project settings** (ikon gerigi) → scroll ke **Your apps** → klik ikon web `</>` → daftarkan app (nama bebas, tidak perlu Firebase Hosting).
5. Salin object `firebaseConfig` yang muncul, tempel ke [js/config.js](js/config.js) menggantikan nilai `ISI_...`.
6. Di tab **Firestore Database → Rules**, ganti isi aturan dengan isi berkas [firestore.rules](firestore.rules) di folder ini, lalu **Publish**.

## 2. Pahami model keamanannya (penting)

Aturan di [firestore.rules](firestore.rules) mengizinkan baca/tulis untuk
siapa pun yang **sudah login** — dan aplikasi ini login secara **anonim
otomatis**, tanpa kata sandi, begitu halamannya dibuka. Artinya:

- Ini menutup akses lewat API mentah bagi orang yang tidak pernah membuka aplikasinya.
- Ini **tidak** memisahkan data per orang. Siapa pun yang membuka tautan situsnya akan berbagi catatan hutang yang sama.

Cocok untuk catatan pribadi yang kamu buka sendiri dari beberapa perangkat.
**Jangan sebarkan tautan situsnya** ke publik kalau tidak ingin orang lain
ikut bisa menambah, mengubah, atau menghapus catatan.

## 3. Terbitkan ke GitHub Pages

1. Jadikan folder `hutang/` ini sebuah repository Git tersendiri (atau push sebagai bagian dari repo yang sudah ada, lalu atur Pages agar melayani folder ini).
   ```bash
   git init
   git add .
   git commit -m "Buku hutang: catat hutang, jatuh tempo, pembayaran"
   git branch -M main
   git remote add origin <url-repo-github-kamu>
   git push -u origin main
   ```
2. Di GitHub, buka repo → **Settings → Pages** → Source pilih branch `main`, folder `/ (root)` → **Save**.
3. Tunggu beberapa menit, situs akan aktif di `https://<username>.github.io/<nama-repo>/`.
4. (Opsional) Untuk subdomain sendiri (mis. `hutang.domainkamu.com`), buat berkas `CNAME` berisi domain tersebut di folder ini, dan arahkan DNS-nya (CNAME record) ke `<username>.github.io`.

## Struktur berkas

```
hutang/
├── index.html          shell aplikasi + pengaman boot
├── firestore.rules      aturan keamanan Firestore
├── assets/style.css     tampilan (tema buku kas)
└── js/
    ├── config.js         KONFIGURASI FIREBASE — isi ini dulu
    ├── util.js           format uang/tanggal, toast, sheet, dsb.
    ├── store.js          login anonim + CRUD Firestore
    ├── pdf.js            pembuatan PDF (rincian & laporan)
    └── app.js            router & semua tampilan
```

## Catatan pengembangan

Setiap kali mengubah `js/*.js` atau `assets/style.css`, naikkan angka versi
di query string (`?v=...`) pada baris import/`<script>` di `index.html` dan
`js/app.js` — ini memastikan browser pengguna mengambil versi terbaru,
bukan versi lama dari cache.
