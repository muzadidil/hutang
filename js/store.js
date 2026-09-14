import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, getDocs, getDoc, addDoc, deleteDoc,
  query, orderBy, runTransaction, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { firebaseConfig } from './config.js?v=2026-09-14-1';

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Cache lokal supaya aplikasi tetap jalan saat sinyal hilang di jalan.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

/** Login anonim berjalan sendiri saat aplikasi dibuka — tidak ada layar
 *  login. Setiap operasi Firestore menunggu janji ini dulu, karena
 *  firestore.rules mensyaratkan request.auth != null.
 *
 *  PENTING: anonim di sini bukan berarti data terkunci per pengunjung.
 *  Semua pengunjung yang berhasil login anonim (yaitu: siapa pun yang
 *  membuka halaman ini) membaca dan menulis koleksi data yang SAMA.
 *  Anonymous Auth di sini hanya menutup akses langsung tanpa lewat
 *  aplikasi (mis. panggilan REST API mentah) — bukan memisahkan data
 *  antar orang. Cocok untuk catatan pribadi yang diakses dari beberapa
 *  perangkat sendiri, tidak cocok kalau linknya disebar ke banyak orang.
 */
export const siap = new Promise((selesai, gagal) => {
  const lepas = onAuthStateChanged(auth, user => {
    if (user) { lepas(); selesai(user); }
  }, gagal);
  signInAnonymously(auth).catch(gagal);
});

const kHutang = () => collection(db, 'hutang');

/* ============================================================
   HUTANG
   ============================================================ */

export async function ambilHutang() {
  await siap;
  const s = await getDocs(query(kHutang(), orderBy('created_at', 'desc')));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function ambilSatu(id) {
  await siap;
  const d = await getDoc(doc(db, 'hutang', id));
  return d.exists() ? { id: d.id, ...d.data() } : null;
}

export async function simpanHutang({ nama, jumlah, tanggal, jatuh_tempo, catatan }, id = null) {
  await siap;
  const dasar = {
    nama,
    jumlah,
    tanggal: Timestamp.fromDate(tanggal),
    jatuh_tempo: jatuh_tempo ? Timestamp.fromDate(jatuh_tempo) : null,
    catatan: catatan || ''
  };

  if (id) {
    // Pokok boleh dikoreksi kapan saja. Pembayaran yang sudah tercatat
    // tetap dipertahankan, sisa dihitung ulang terhadap pokok yang baru.
    return runTransaction(db, async tx => {
      const ref  = doc(db, 'hutang', id);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Data hutang sudah tidak ada. Muat ulang halaman.');
      const terbayar = snap.data().terbayar || 0;
      const sisa = Math.max(0, jumlah - terbayar);
      tx.update(ref, { ...dasar, terbayar, sisa, lunas: sisa <= 0 });
    });
  }

  return addDoc(kHutang(), {
    ...dasar,
    pembayaran: [],
    terbayar: 0,
    sisa: Math.max(0, jumlah),
    lunas: jumlah <= 0,
    created_at: serverTimestamp()
  });
}

export async function hapusHutang(id) {
  await siap;
  await deleteDoc(doc(db, 'hutang', id));
}

/* ============================================================
   PEMBAYARAN — disimpan sebagai daftar di dalam dokumen hutang.
   ============================================================ */

export async function tambahPembayaran(id, { tanggal, jumlah, catatan }) {
  await siap;
  return runTransaction(db, async tx => {
    const ref  = doc(db, 'hutang', id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Data hutang sudah tidak ada. Muat ulang halaman.');
    const h = snap.data();
    const pembayaran = [
      ...(h.pembayaran || []),
      { tanggal: Timestamp.fromDate(tanggal), jumlah, catatan: catatan || '' }
    ];
    const terbayar = pembayaran.reduce((n, p) => n + (p.jumlah || 0), 0);
    const sisa = Math.max(0, (h.jumlah || 0) - terbayar);
    tx.update(ref, { pembayaran, terbayar, sisa, lunas: sisa <= 0 });
    return { terbayar, sisa };
  });
}

export async function hapusPembayaran(id, index) {
  await siap;
  return runTransaction(db, async tx => {
    const ref  = doc(db, 'hutang', id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Data hutang sudah tidak ada. Muat ulang halaman.');
    const h = snap.data();
    const pembayaran = (h.pembayaran || []).filter((_, i) => i !== index);
    const terbayar = pembayaran.reduce((n, p) => n + (p.jumlah || 0), 0);
    const sisa = Math.max(0, (h.jumlah || 0) - terbayar);
    tx.update(ref, { pembayaran, terbayar, sisa, lunas: sisa <= 0 });
  });
}

/* ============================================================
   RINGKASAN
   ============================================================ */

export async function ringkasan() {
  const daftar = await ambilHutang();
  const belum  = daftar.filter(h => !h.lunas);
  return {
    daftar,
    belum,
    jumlahBelum:    belum.length,
    totalPokok:     daftar.reduce((n, h) => n + (h.jumlah || 0), 0),
    totalTerbayar:  daftar.reduce((n, h) => n + (h.terbayar || 0), 0),
    totalSisa:      daftar.reduce((n, h) => n + (h.sisa || 0), 0)
  };
}
