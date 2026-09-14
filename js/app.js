import { judulAplikasi, APP_PASSWORD } from './config.js?v=2026-09-14-3';
import {
  rp, bacaAngka, tgl, tglPanjang, tempoTeks, selisihHari,
  hariIni, dariInput, keInput, plusHari, keDate, $, $$, aman, toast,
  bukaSheet, tutupSheet, konfirmasi
} from './util.js?v=2026-09-14-3';
import * as S from './store.js?v=2026-09-14-3';
import { barisHutang, buatPDF, pratinjauHTML, buatLaporanPDF, bagikanPDF } from './pdf.js?v=2026-09-14-3';

const VERSI = '2026-09-14 · 2';

// Beri tahu pengaman di index.html bahwa modul berhasil jalan.
window.bukuHutangSiap?.();

/* ============================================================
   BOOT — tunggu login anonim ke Firebase, lalu tampilkan
   gerbang kata sandi (atau langsung masuk kalau sesi sudah ada).
   ============================================================ */

const KUNCI_SESI = 'hutang_masuk';

function bukaGerbang() {
  $('#gate').hidden  = true;
  $('#shell').hidden = false;
  jalankanRute();
}

(async () => {
  try {
    await S.siap;
  } catch (e) {
    console.error(e);
    $('#boot').innerHTML = `
      <div style="max-width:340px;padding:24px;text-align:center">
        <p style="font-weight:800;font-size:1.05rem;margin:0 0 8px">Gagal terhubung</p>
        <p style="color:var(--tinta-lembut);font-size:.9rem;margin:0 0 20px">
          Tidak bisa masuk secara anonim ke Firebase. Periksa js/config.js dan
          pastikan metode masuk "Anonymous" sudah diaktifkan di Firebase Console.
        </p>
        <button class="btn btn-primary btn-block" onclick="location.reload()">Coba lagi</button>
      </div>`;
    return;
  }
  $('#boot').hidden = true;
  if (localStorage.getItem(KUNCI_SESI) === '1') {
    bukaGerbang();
  } else {
    $('#gate').hidden = false;
    $('#gPass').focus();
  }
})();

$('#gBtn').onclick = () => {
  const salah = $('#gErr');
  if ($('#gPass').value === APP_PASSWORD) {
    localStorage.setItem(KUNCI_SESI, '1');
    salah.hidden = true;
    bukaGerbang();
  } else {
    salah.textContent = 'Kata sandi salah.';
    salah.hidden = false;
  }
};

$('#gPass').addEventListener('keydown', e => { if (e.key === 'Enter') $('#gBtn').click(); });

/* ============================================================
   MENU LAINNYA
   ============================================================ */

$('#menuBtn').onclick = () => {
  bukaSheet(`
    <h2 class="sheet-judul">Lainnya</h2>
    <button class="sheet-menu" data-go="#/laporan">Laporan &amp; cetak PDF<small>Rekap semua hutang</small></button>
    <button class="sheet-menu" id="mSegar">Muat ulang versi terbaru<small>Pakai kalau ada yang aneh setelah aplikasi diperbarui</small></button>
    <button class="sheet-menu" id="mTentang">Tentang aplikasi ini<small>Cara kerja kata sandi &amp; login anonim</small></button>
    <button class="sheet-menu" id="mKeluar" style="color:var(--merah)">Keluar</button>
    <p class="field-hint" style="text-align:center;margin-top:16px">Versi ${aman(VERSI)}</p>`);

  $$('[data-go]').forEach(b => b.onclick = () => { tutupSheet(); location.hash = b.dataset.go; });

  $('#mSegar').onclick = async () => {
    tutupSheet();
    toast('Mengambil versi terbaru…');
    const berkas = ['index.html', 'assets/style.css', 'js/app.js', 'js/store.js', 'js/util.js', 'js/pdf.js', 'js/config.js'];
    await Promise.all(berkas.map(f => fetch(f, { cache: 'reload' }).catch(() => {})));
    location.reload();
  };

  $('#mTentang').onclick = () => {
    bukaSheet(`
      <h2 class="sheet-judul">Tentang aplikasi ini</h2>
      <p style="color:var(--tinta-lembut);font-size:.9rem;margin-bottom:12px">
        Kata sandi di layar masuk hanya penghalang tampilan di sisi browser —
        siapa pun yang membaca kode sumbernya bisa melihat kata sandi itu.
        Keamanan data sesungguhnya ada pada aturan Firestore, bukan kata sandi.
      </p>
      <p style="color:var(--tinta-lembut);font-size:.9rem;margin-bottom:12px">
        Setelah lolos kata sandi, aplikasi juga masuk ke Firebase secara
        anonim dan otomatis. Ini menutup akses langsung ke database dari luar
        aplikasi, tapi <strong>bukan</strong> mengunci data khusus untuk satu
        orang — siapa pun yang tahu kata sandinya membaca dan menulis catatan
        yang sama.
      </p>
      <p style="color:var(--tinta-lembut);font-size:.9rem">
        Cocok untuk catatan pribadi yang kamu buka sendiri dari beberapa HP
        atau komputer. Jangan sebarkan kata sandi atau tautannya kalau tidak
        mau orang lain ikut bisa mengubah atau menghapus catatan.
      </p>
      <button class="btn btn-garis btn-block" data-close style="margin-top:20px">Tutup</button>`);
  };

  $('#mKeluar').onclick = async () => {
    tutupSheet();
    if (await konfirmasi({ judul: 'Keluar?', pesan: 'Kamu perlu masukkan kata sandi lagi nanti.', aksi: 'Keluar', bahaya: true })) {
      localStorage.removeItem(KUNCI_SESI);
      location.reload();
    }
  };
};

/* ============================================================
   ROUTER
   ============================================================ */

const RUTE = {
  beranda: { judul: 'Beranda', tab: 'beranda', render: vBeranda },
  hutang:  { judul: 'Hutang',  tab: 'hutang',  render: vHutang },
  laporan: { judul: 'Laporan', tab: 'laporan', render: vLaporan }
};

function pecahRute() {
  const bagian = (location.hash || '#/beranda').replace(/^#\/?/, '').split('/');
  return { nama: bagian[0] || 'beranda', anak: bagian[1] || '', cucu: bagian[2] || '' };
}

async function jalankanRute() {
  if ($('#shell').hidden) return;
  const { nama, anak, cucu } = pecahRute();
  const r = RUTE[nama] || RUTE.beranda;

  $('#viewTitle').textContent = r.judul;
  $$('.tabbar a').forEach(a => a.toggleAttribute('aria-current', a.dataset.tab === r.tab));

  const wadah = $('#view');
  wadah.innerHTML = `<div class="kosong"><p>Memuat…</p></div>`;
  window.scrollTo(0, 0);

  try {
    await r.render(wadah, anak, cucu);
  } catch (e) {
    console.error(e);
    wadah.innerHTML = `<div class="peringatan">Gagal memuat: ${aman(e.message || e)}</div>
      <button class="btn btn-garis btn-block" onclick="location.reload()">Muat ulang</button>`;
  }
}

addEventListener('hashchange', jalankanRute);

/* Delegasi klik baris — dipakai di Beranda, Hutang, dan Laporan. Simpan
   daftar yang sedang tampil supaya klik cukup mencari di memori. */
let cacheHutang = [];

$('#view').addEventListener('click', e => {
  const b = e.target.closest('[data-lihat]');
  if (!b) return;
  const h = cacheHutang.find(x => x.id === b.dataset.lihat);
  if (h) rincianHutang(h);
});

/* ============================================================
   BERANDA
   ============================================================ */

async function vBeranda(w) {
  const r = await S.ringkasan();
  cacheHutang = r.daftar;

  const belumUrut = r.belum.slice().sort((a, b) => {
    const ta = keDate(a.jatuh_tempo)?.getTime() ?? Infinity;
    const tb = keDate(b.jatuh_tempo)?.getTime() ?? Infinity;
    return ta - tb;
  });
  const terdekat = belumUrut[0] || null;
  const tempo = terdekat ? tempoTeks(terdekat.jatuh_tempo) : null;

  const lewat = r.belum.filter(h => h.jatuh_tempo && (selisihHari(h.jatuh_tempo) ?? 0) < 0);
  const nilaiLewat = lewat.reduce((n, h) => n + (h.sisa || 0), 0);

  const peringatan = lewat.length
    ? `<div class="peringatan">${lewat.length} hutang sudah lewat jatuh tempo, senilai ${rp(nilaiLewat)}.</div>`
    : '';

  const daftar = belumUrut.length
    ? `<div class="ledger">${belumUrut.map(barisRingkas).join('')}</div>`
    : `<div class="kosong"><h3>Tidak ada hutang berjalan</h3>
         <p>Semua catatan hutang sudah lunas.</p>
         <a class="btn btn-primary" href="#/hutang/baru">Catat hutang baru</a></div>`;

  w.innerHTML = `
    ${peringatan}
    <section class="kop">
      <p class="kop-label">Total sisa hutang</p>
      <p class="kop-angka">${rp(r.totalSisa)}</p>
      <p class="kop-sub">${r.jumlahBelum} catatan belum lunas</p>
      <div class="kop-pisah"></div>
      <div class="kop-grid">
        <div><p>Jatuh tempo terdekat</p><p class="${tempo?.kelas === 'jatuh' ? 'merah' : ''}">${tempo ? aman(tempo.teks) : '—'}</p></div>
        <div><p>Kepada</p><p>${terdekat ? aman(terdekat.nama) : '—'}</p></div>
      </div>
    </section>

    <a class="btn btn-primary btn-block" href="#/hutang/baru" style="margin-bottom:8px">Catat hutang baru</a>

    <div class="bagian"><h2>Hutang berjalan</h2><span>urut jatuh tempo</span></div>
    ${daftar}`;
}

function barisRingkas(h) {
  const t = tempoTeks(h.jatuh_tempo);
  return `<button class="baris ${t.kelas}" data-lihat="${h.id}">
    <div class="baris-atas">
      <span class="baris-judul">${aman(h.nama)}</span>
      <span class="baris-nilai">${rp(h.sisa)}</span>
    </div>
    <div class="baris-bawah">
      <span class="${t.kelas === 'jatuh' ? 'merah' : ''}">${aman(t.teks)}</span>
      <span>berhutang ${tgl(h.tanggal)}</span>
    </div>
  </button>`;
}

/* ============================================================
   DAFTAR HUTANG
   ============================================================ */

let filterAktif = 'belum';

async function vHutang(w, anak, cucu) {
  if (anak === 'baru') return formHutang(w);
  if (anak === 'ubah' && cucu) {
    const h = await S.ambilSatu(cucu);
    if (!h) {
      w.innerHTML = `<div class="kosong"><h3>Tidak ditemukan</h3><a class="btn btn-garis" href="#/hutang">Kembali</a></div>`;
      return;
    }
    return formHutang(w, h);
  }

  const semua = await S.ambilHutang();
  cacheHutang = semua;

  const cocok = h => filterAktif === 'semua' ? true : filterAktif === 'lunas' ? h.lunas : !h.lunas;
  const daftar = semua.filter(cocok);

  const pil = (nilai, label) =>
    `<button class="filter-pil ${filterAktif === nilai ? 'aktif' : ''}" data-filter="${nilai}">${label}</button>`;

  w.innerHTML = `
    <a class="btn btn-primary btn-block" href="#/hutang/baru" style="margin-bottom:16px">Catat hutang baru</a>
    <div class="filter-baris">
      ${pil('belum', 'Belum lunas')}
      ${pil('semua', 'Semua')}
      ${pil('lunas', 'Lunas')}
    </div>
    ${daftar.length
      ? `<div class="ledger">${daftar.map(h => {
          const t = h.lunas ? { teks: 'Lunas', kelas: 'lunas' } : tempoTeks(h.jatuh_tempo);
          return `<button class="baris ${t.kelas}" data-lihat="${h.id}">
            <div class="baris-atas">
              <span class="baris-judul">${aman(h.nama)}</span>
              <span class="baris-nilai ${h.lunas ? 'hijau' : ''}">${h.lunas ? rp(h.jumlah) : rp(h.sisa)}</span>
            </div>
            <div class="baris-bawah">
              <span class="${t.kelas === 'jatuh' ? 'merah' : ''}">${aman(t.teks)}</span>
              <span>berhutang ${tgl(h.tanggal)}</span>
            </div>
          </button>`;
        }).join('')}</div>`
      : `<div class="kosong"><h3>Belum ada catatan</h3><p>Tidak ada hutang pada kategori ini.</p></div>`}`;

  $$('[data-filter]').forEach(b => b.onclick = () => { filterAktif = b.dataset.filter; jalankanRute(); });
}

const TEMPO_HARI = 30;

function formHutang(w, existing = null) {
  const form = {
    nama:   existing?.nama || '',
    jumlah: existing?.jumlah || 0,
    tgl:    existing ? keInput(existing.tanggal) : hariIni(),
    tempo:  existing?.jatuh_tempo ? keInput(existing.jatuh_tempo) : plusHari(hariIni(), TEMPO_HARI),
    // Sudah ada jatuh tempo tersimpan (mode ubah) dianggap "sudah diatur manual"
    // supaya tidak diam-diam digeser lagi saat tanggal berhutang diubah.
    tempoDiubah: !!existing?.jatuh_tempo
  };

  const gambar = () => {
    w.innerHTML = `
    <label class="field"><span>Berhutang kepada</span>
      <input id="fNama" value="${aman(form.nama)}" placeholder="mis. Budi, Koperasi, Bank ABC"></label>

    <label class="field uang"><span>Jumlah hutang</span>
      <input id="fJumlah" inputmode="numeric" value="${form.jumlah ? new Intl.NumberFormat('id-ID').format(form.jumlah) : ''}" placeholder="0"></label>

    <label class="field"><span>Tanggal berhutang</span>
      <input type="date" id="fTgl" value="${form.tgl}"></label>

    <label class="field"><span>Jatuh tempo</span>
      <input type="date" id="fTempo" value="${form.tempo}">
      <span class="field-hint">Bawaan ${TEMPO_HARI} hari dari tanggal berhutang — boleh diubah bebas sesuai kesepakatan.</span></label>
    <div class="filter-baris" style="margin:-8px 0 16px">
      ${[7, 14, 30, 60, 90].map(n => `<button class="filter-pil ${n === TEMPO_HARI && !form.tempoDiubah ? 'aktif' : ''}" data-hari="${n}">${n} hari</button>`).join('')}
    </div>

    <label class="field"><span>Catatan</span>
      <input id="fCatatan" value="${aman(form.catatan)}" placeholder="opsional"></label>

    <button class="btn btn-primary btn-block" id="fSimpan">${existing ? 'Simpan perubahan' : 'Simpan hutang'}</button>
    ${existing ? `<button class="btn btn-garis btn-block" id="fBatal" style="margin-top:12px">Batal</button>` : ''}`;

    $('#fJumlah').oninput = e => {
      const n = bacaAngka(e.target.value);
      e.target.value = n ? new Intl.NumberFormat('id-ID').format(n) : '';
    };

    $('#fTgl').onchange = () => {
      form.tgl = $('#fTgl').value;
      // Jatuh tempo ikut geser selama belum diubah manual oleh pengguna.
      if (!form.tempoDiubah && form.tgl) {
        form.tempo = plusHari(form.tgl, TEMPO_HARI);
        $('#fTempo').value = form.tempo;
      }
    };
    $('#fTempo').onchange = () => { form.tempo = $('#fTempo').value; form.tempoDiubah = true; };

    $$('[data-hari]').forEach(b => b.onclick = () => {
      form.tempo = plusHari($('#fTgl').value || form.tgl, +b.dataset.hari);
      form.tempoDiubah = true;
      $('#fTempo').value = form.tempo;
      $$('[data-hari]').forEach(x => x.classList.toggle('aktif', x === b));
    });

    if (existing) $('#fBatal').onclick = () => { location.hash = '#/hutang'; };
    $('#fSimpan').onclick = simpan;
  };

  async function simpan() {
    const nama = $('#fNama').value.trim();
    const jumlah = bacaAngka($('#fJumlah').value);
    const tanggal = dariInput($('#fTgl').value) || new Date();
    const jatuh_tempo = dariInput($('#fTempo').value);
    const catatan = $('#fCatatan').value.trim();

    if (!nama) return toast('Nama pihak yang memberi hutang wajib diisi.', true);
    if (jumlah <= 0) return toast('Jumlah hutang harus lebih dari 0.', true);

    const b = $('#fSimpan');
    b.disabled = true; b.textContent = 'Menyimpan…';
    try {
      await S.simpanHutang({ nama, jumlah, tanggal, jatuh_tempo, catatan }, existing?.id || null);
      toast(existing ? 'Perubahan disimpan.' : 'Hutang tersimpan.');
      location.hash = '#/hutang';
    } catch (e) {
      toast(e.message || 'Gagal menyimpan.', true);
      b.disabled = false; b.textContent = existing ? 'Simpan perubahan' : 'Simpan hutang';
    }
  }

  gambar();
}

/* ---------- rincian + pembayaran ---------- */

function rincianHutang(h) {
  const t = h.lunas ? { teks: 'Lunas', kelas: 'lunas' } : tempoTeks(h.jatuh_tempo);
  const pembayaran = h.pembayaran || [];

  bukaSheet(`
    <h2 class="sheet-judul">${aman(h.nama)}</h2>
    <div class="rincian ${h.lunas ? '' : (t.kelas === 'jatuh' ? 'bahaya' : '')}">
      <div class="rincian-baris"><span>Jumlah hutang</span><span>${rp(h.jumlah)}</span></div>
      <div class="rincian-baris"><span>Sudah dibayar</span><span>${rp(h.terbayar || 0)}</span></div>
      <div class="rincian-baris" style="border-top:1px solid var(--cap);margin-top:8px;padding-top:8px"><span>Sisa hutang</span><span>${rp(h.sisa)}</span></div>
    </div>
    <div class="rincian-baris"><span>Tanggal berhutang</span><span>${tglPanjang(h.tanggal)}</span></div>
    <div class="rincian-baris"><span>Jatuh tempo</span><span>${h.jatuh_tempo ? tgl(h.jatuh_tempo) : 'tidak ditentukan'}</span></div>
    <div class="rincian-baris"><span>Status</span><span>${aman(t.teks)}</span></div>
    ${h.catatan ? `<p style="margin-top:12px;color:var(--tinta-lembut);font-size:.88rem">${aman(h.catatan)}</p>` : ''}

    <div class="bagian"><h2>Riwayat pembayaran</h2><span>${pembayaran.length} kali</span></div>
    ${pembayaran.length
      ? pembayaran.map((p, i) => `
        <div class="item">
          <div class="item-kepala">
            <strong>${rp(p.jumlah)}</strong>
            <button class="item-buang" data-hapus-bayar="${i}">Hapus</button>
          </div>
          <p style="font-size:.85rem;color:var(--tinta-lembut)">${tgl(p.tanggal)}${p.catatan ? ' · ' + aman(p.catatan) : ''}</p>
        </div>`).join('')
      : `<p style="color:var(--tinta-lembut);font-size:.88rem;margin-bottom:16px">Belum ada pembayaran.</p>`}

    ${!h.lunas ? `<button class="btn btn-primary btn-block" id="hBayar" style="margin-bottom:12px">Catat pembayaran</button>` : ''}
    <button class="btn btn-garis btn-block" id="hCetak" style="margin-bottom:12px">Cetak PDF</button>
    <button class="btn btn-garis btn-block" id="hUbah" style="margin-bottom:12px">Ubah</button>
    <button class="btn btn-bahaya btn-block" id="hHapus" style="margin-bottom:12px">Hapus</button>
    <button class="btn btn-garis btn-block" data-close>Tutup</button>`);

  $$('[data-hapus-bayar]').forEach(btn => btn.onclick = async () => {
    const index = +btn.dataset.hapusBayar;
    tutupSheet();
    if (!await konfirmasi({
      judul: 'Hapus pembayaran ini?',
      pesan: 'Sisa hutang akan bertambah lagi sebesar pembayaran yang dihapus. Tidak bisa dibatalkan.',
      aksi: 'Hapus', bahaya: true
    })) { rincianHutang(h); return; }
    try {
      await S.hapusPembayaran(h.id, index);
      toast('Pembayaran dihapus.');
      const baru = await S.ambilSatu(h.id);
      jalankanRute();
      if (baru) rincianHutang(baru);
    } catch (e) { toast(e.message || 'Gagal menghapus.', true); }
  });

  if (!h.lunas) {
    $('#hBayar').onclick = () => formPembayaran(h);
  }

  $('#hCetak').onclick = () => tampilkanNota(h);

  $('#hUbah').onclick = () => { tutupSheet(); location.hash = `#/hutang/ubah/${h.id}`; };

  $('#hHapus').onclick = async () => {
    tutupSheet();
    if (!await konfirmasi({
      judul: `Hapus hutang ke ${h.nama}?`,
      pesan: `Seluruh catatan dan riwayat pembayarannya akan hilang. Tidak bisa dibatalkan.`,
      aksi: 'Hapus', bahaya: true
    })) return;
    try {
      await S.hapusHutang(h.id);
      toast('Hutang dihapus.');
      jalankanRute();
    } catch (e) { toast(e.message || 'Gagal menghapus.', true); }
  };
}

function formPembayaran(h) {
  bukaSheet(`
    <h2 class="sheet-judul">Catat pembayaran</h2>
    <p style="color:var(--tinta-lembut);font-size:.88rem;margin-bottom:16px">Sisa hutang saat ini: <strong>${rp(h.sisa)}</strong></p>

    <label class="field"><span>Tanggal bayar</span>
      <input type="date" id="pTgl" value="${hariIni()}"></label>

    <label class="field uang"><span>Jumlah dibayar</span>
      <input id="pJumlah" inputmode="numeric" value="${new Intl.NumberFormat('id-ID').format(h.sisa)}"></label>

    <label class="field"><span>Catatan</span>
      <input id="pCatatan" placeholder="opsional"></label>

    <button class="btn btn-primary btn-block" id="pSimpan">Simpan pembayaran</button>
    <button class="btn btn-garis btn-block" id="pBatal" style="margin-top:12px">Batal</button>`);

  $('#pJumlah').oninput = e => {
    const n = bacaAngka(e.target.value);
    e.target.value = n ? new Intl.NumberFormat('id-ID').format(n) : '';
  };

  $('#pBatal').onclick = () => { tutupSheet(); rincianHutang(h); };

  $('#pSimpan').onclick = async () => {
    const tanggal = dariInput($('#pTgl').value) || new Date();
    const jumlah = bacaAngka($('#pJumlah').value);
    const catatan = $('#pCatatan').value.trim();

    if (jumlah <= 0) return toast('Jumlah pembayaran harus lebih dari 0.', true);

    if (jumlah > h.sisa && !await konfirmasi({
      judul: 'Melebihi sisa hutang?',
      pesan: `Sisa hutang hanya ${rp(h.sisa)}, tapi kamu mengisi ${rp(jumlah)}. Tetap simpan?`,
      aksi: 'Tetap simpan'
    })) return;

    const b = $('#pSimpan');
    b.disabled = true; b.textContent = 'Menyimpan…';
    try {
      await S.tambahPembayaran(h.id, { tanggal, jumlah, catatan });
      toast('Pembayaran tersimpan.');
      tutupSheet();
      jalankanRute();
      const baru = await S.ambilSatu(h.id);
      if (baru) rincianHutang(baru);
    } catch (e) {
      toast(e.message || 'Gagal menyimpan.', true);
      b.disabled = false; b.textContent = 'Simpan pembayaran';
    }
  };
}

function tampilkanNota(h) {
  const baris = barisHutang(h);
  bukaSheet(`
    <h2 class="sheet-judul">Cetak PDF — ${aman(h.nama)}</h2>
    <div class="slip">${pratinjauHTML(baris)}</div>
    <button class="btn btn-primary btn-block" id="nKirim" style="margin-bottom:12px">Simpan / bagikan PDF</button>
    <button class="btn btn-garis btn-block" id="nTutup">Tutup</button>`);

  $('#nKirim').onclick = async () => {
    const b = $('#nKirim');
    b.disabled = true; b.textContent = 'Menyiapkan…';
    try {
      const namaFile = `hutang-${h.nama.replace(/[^a-z0-9]+/gi, '-')}.pdf`;
      const hasil = await bagikanPDF(buatPDF(baris), namaFile);
      if (hasil === 'terunduh') toast('PDF terunduh.');
      else if (hasil === 'terkirim') toast('PDF terkirim.');
    } catch { toast('Gagal membuat PDF.', true); }
    b.disabled = false; b.textContent = 'Simpan / bagikan PDF';
  };

  $('#nTutup').onclick = () => { tutupSheet(); rincianHutang(h); };
}

/* ============================================================
   LAPORAN
   ============================================================ */

async function vLaporan(w) {
  const r = await S.ringkasan();
  cacheHutang = r.daftar;

  const urut = r.daftar.slice().sort((a, b) => {
    if (a.lunas !== b.lunas) return a.lunas ? 1 : -1;
    const ta = keDate(a.jatuh_tempo)?.getTime() ?? Infinity;
    const tb = keDate(b.jatuh_tempo)?.getTime() ?? Infinity;
    return ta - tb;
  });

  w.innerHTML = `
    <section class="kop">
      <p class="kop-label">Total sisa hutang</p>
      <p class="kop-angka">${rp(r.totalSisa)}</p>
      <div class="kop-pisah"></div>
      <div class="kop-grid">
        <div><p>Total pokok</p><p>${rp(r.totalPokok)}</p></div>
        <div><p>Total terbayar</p><p>${rp(r.totalTerbayar)}</p></div>
      </div>
    </section>

    <button class="btn btn-primary btn-block" id="lCetak" style="margin-bottom:16px">Cetak laporan PDF</button>

    <div class="bagian"><h2>Semua hutang</h2><span>${urut.length} catatan</span></div>
    ${urut.length
      ? `<div class="ledger">${urut.map(h => {
          const t = h.lunas ? { teks: 'Lunas', kelas: 'lunas' } : tempoTeks(h.jatuh_tempo);
          return `<button class="baris ${t.kelas}" data-lihat="${h.id}">
            <div class="baris-atas">
              <span class="baris-judul">${aman(h.nama)}</span>
              <span class="baris-nilai ${h.lunas ? 'hijau' : ''}">${h.lunas ? rp(h.jumlah) : rp(h.sisa)}</span>
            </div>
            <div class="baris-bawah">
              <span class="${t.kelas === 'jatuh' ? 'merah' : ''}">${aman(t.teks)}</span>
              <span>berhutang ${tgl(h.tanggal)}</span>
            </div>
          </button>`;
        }).join('')}</div>`
      : `<div class="kosong"><h3>Belum ada catatan</h3></div>`}`;

  $('#lCetak').onclick = async () => {
    const b = $('#lCetak');
    b.disabled = true; b.textContent = 'Menyiapkan…';
    try {
      const doc = buatLaporanPDF(urut, r);
      const hasil = await bagikanPDF(doc, `laporan-hutang-${hariIni()}.pdf`);
      if (hasil === 'terunduh') toast('Laporan PDF terunduh.');
      else if (hasil === 'terkirim') toast('Laporan PDF terkirim.');
    } catch { toast('Gagal membuat PDF.', true); }
    b.disabled = false; b.textContent = 'Cetak laporan PDF';
  };
}
