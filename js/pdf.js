import { judulAplikasi } from './config.js?v=2026-09-14-3';
import { rp, tgl, tglPanjang, tempoTeks } from './util.js?v=2026-09-14-3';

/* ============================================================
   PDF RINCIAN SATU HUTANG — bentuk nota/slip, dibuat ULANG dari
   data setiap kali dicetak, bukan disimpan sebagai file.
   ============================================================ */

const LEBAR   = 80;   // mm
const TEPI    = 6;

const bungkus = (teks, kolom = 40) => {
  const kata = String(teks).split(/\s+/);
  const baris = [];
  let kini = '';
  for (const k of kata) {
    if (!kini) { kini = k; }
    else if ((kini + ' ' + k).length <= kolom) { kini += ' ' + k; }
    else { baris.push(kini); kini = k; }
  }
  if (kini) baris.push(kini);
  return baris.length ? baris : [''];
};

const K  = t => ({ t: 'kop', v: t });
const T  = t => ({ t: 'teks', v: t });
const P  = (a, b) => ({ t: 'pasang', a, b });
const PB = (a, b) => ({ t: 'pasang', a, b, tebal: true });
const G  = () => ({ t: 'garis' });
const S  = (n = 1) => ({ t: 'spasi', n });

/** Susun baris rincian satu hutang, dari nol sampai kaki cetak. */
export function barisHutang(h) {
  const b = [
    K(judulAplikasi.toUpperCase()),
    T('Rincian hutang'),
    G(),
    P('Kepada', h.nama),
    P('Tanggal', tgl(h.tanggal)),
    G(),
    PB('Jumlah hutang', rp(h.jumlah))
  ];

  if ((h.pembayaran || []).length) {
    b.push(G(), T('Riwayat pembayaran:'));
    h.pembayaran.forEach(p => {
      b.push(P('  ' + tgl(p.tanggal), rp(p.jumlah)));
      if (p.catatan) b.push(T('    ' + p.catatan));
    });
  }

  b.push(
    G(),
    P('Total dibayar', rp(h.terbayar || 0)),
    PB('Sisa hutang', rp(h.sisa))
  );

  const t = h.lunas ? 'LUNAS' : tempoTeks(h.jatuh_tempo).teks;
  b.push(
    G(),
    PB('Jatuh tempo', h.jatuh_tempo ? tgl(h.jatuh_tempo) : 'belum ditentukan'),
    T('  Status: ' + t)
  );

  if (h.catatan) b.push(G(), T('Catatan: ' + h.catatan));

  b.push(
    G(), S(),
    T('Dicetak ' + new Date().toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }))
  );

  return b;
}

const TINGGI = { kop: 5.4, teks: 4.3, pasang: 4.3, garis: 3.4, spasi: 2.6 };

function ukur(baris) {
  let h = TEPI * 2;
  for (const b of baris) {
    if (b.t === 'spasi')  { h += TINGGI.spasi * (b.n || 1); continue; }
    if (b.t === 'garis')  { h += TINGGI.garis; continue; }
    if (b.t === 'pasang') { h += TINGGI.pasang; continue; }
    h += bungkus(b.v).length * TINGGI[b.t];
  }
  return Math.max(90, h);
}

export function buatPDF(baris) {
  const { jsPDF } = window.jspdf;
  const tinggi = ukur(baris);
  const d = new jsPDF({ unit: 'mm', format: [LEBAR, tinggi], compress: true });

  const kiri  = TEPI;
  const kanan = LEBAR - TEPI;
  let y = TEPI + 4;

  for (const b of baris) {
    if (b.t === 'spasi') { y += TINGGI.spasi * (b.n || 1); continue; }

    if (b.t === 'garis') {
      d.setDrawColor(140); d.setLineWidth(0.15);
      d.setLineDashPattern([0.8, 0.8], 0);
      d.line(kiri, y - 1.4, kanan, y - 1.4);
      d.setLineDashPattern([], 0);
      y += TINGGI.garis;
      continue;
    }

    if (b.t === 'kop') {
      d.setFont('helvetica', 'bold'); d.setFontSize(11);
      bungkus(b.v, 26).forEach(t => { d.text(t, LEBAR / 2, y, { align: 'center' }); y += TINGGI.kop; });
      continue;
    }

    if (b.t === 'pasang') {
      d.setFont('courier', b.tebal ? 'bold' : 'normal');
      d.setFontSize(b.tebal ? 9 : 8);
      d.text(String(b.a), kiri, y);
      d.text(String(b.b), kanan, y, { align: 'right' });
      y += TINGGI.pasang;
      continue;
    }

    d.setFont('courier', 'normal'); d.setFontSize(8);
    bungkus(b.v).forEach(t => { d.text(t, kiri, y); y += TINGGI.teks; });
  }

  return d;
}

export function pratinjauHTML(baris) {
  return baris.map(b => {
    if (b.t === 'spasi')  return `<div style="height:${(b.n || 1) * 8}px"></div>`;
    if (b.t === 'garis')  return '<div style="border-top:1px dashed #999;margin:8px 0"></div>';
    if (b.t === 'kop')    return `<div class="slip-kop"><b>${escapeHtml(b.v)}</b></div>`;
    if (b.t === 'pasang') return `<div class="slip-baris"${b.tebal ? ' style="font-weight:700"' : ''}><span>${escapeHtml(b.a)}</span><span>${escapeHtml(b.b)}</span></div>`;
    return `<div>${escapeHtml(b.v)}</div>`;
  }).join('');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

/* ============================================================
   PDF LAPORAN LENGKAP — tabel A4 berisi semua hutang.
   ============================================================ */

export function buatLaporanPDF(daftar, ring) {
  const { jsPDF } = window.jspdf;
  const d = new jsPDF({ unit: 'mm', format: 'a4' });
  const kiri = 14, kanan = 196;
  let y = 18;

  d.setFont('helvetica', 'bold'); d.setFontSize(15);
  d.text(judulAplikasi, kiri, y); y += 6;

  d.setFont('helvetica', 'normal'); d.setFontSize(9);
  d.setTextColor(90);
  d.text('Laporan hutang — dicetak ' + new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }), kiri, y);
  d.setTextColor(0);
  y += 9;

  d.setFont('helvetica', 'bold'); d.setFontSize(10);
  d.text(`Total pokok: ${rp(ring.totalPokok)}`, kiri, y); y += 5.5;
  d.text(`Total terbayar: ${rp(ring.totalTerbayar)}`, kiri, y); y += 5.5;
  d.text(`Total sisa: ${rp(ring.totalSisa)}`, kiri, y); y += 5.5;
  d.setFont('helvetica', 'normal'); d.setFontSize(9);
  d.text(`${ring.jumlahBelum} dari ${daftar.length} hutang masih berjalan`, kiri, y);
  y += 9;

  const kol = { nama: kiri, tgl: 62, tempo: 88, pokok: 142, sisa: 174, status: 178 };

  const header = () => {
    d.setFont('helvetica', 'bold'); d.setFontSize(8.5);
    d.text('Kepada', kol.nama, y);
    d.text('Tanggal', kol.tgl, y);
    d.text('Jatuh tempo', kol.tempo, y);
    d.text('Pokok', kol.pokok, y, { align: 'right' });
    d.text('Sisa', kol.sisa, y, { align: 'right' });
    d.text('Status', kol.status, y);
    y += 2;
    d.setDrawColor(150); d.setLineWidth(0.2);
    d.line(kiri, y, kanan, y);
    y += 4.5;
    d.setFont('helvetica', 'normal');
  };

  header();

  daftar.forEach(h => {
    if (y > 282) { d.addPage(); y = 18; header(); }
    const status = h.lunas ? 'Lunas' : tempoTeks(h.jatuh_tempo).teks;
    d.setFontSize(8.5);
    d.text(String(h.nama || '-').slice(0, 26), kol.nama, y);
    d.text(tgl(h.tanggal), kol.tgl, y);
    d.text(h.jatuh_tempo ? tgl(h.jatuh_tempo) : '-', kol.tempo, y);
    d.text(rp(h.jumlah), kol.pokok, y, { align: 'right' });
    d.text(rp(h.sisa), kol.sisa, y, { align: 'right' });
    if (!h.lunas && status.startsWith('Lewat')) d.setTextColor(192, 52, 43); else d.setTextColor(0);
    d.text(status, kol.status, y);
    d.setTextColor(0);
    y += 6;
  });

  return d;
}

/* ---------- kirim / simpan ---------- */

export async function bagikanPDF(doc, namaFile) {
  const blob = doc.output('blob');
  const file = new File([blob], namaFile, { type: 'application/pdf' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: namaFile });
      return 'terkirim';
    } catch (e) {
      if (e.name === 'AbortError') return 'batal';
    }
  }

  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: namaFile });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'terunduh';
}
