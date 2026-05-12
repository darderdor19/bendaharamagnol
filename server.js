require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db      = require('./database');

const app  = express();
const PORT = 5000; // Ganti ke 5000 biar aman dari bentrokan port

app.use(cors());
app.use(express.json());

// ── Static files (Root) ───────────────────────────────────────────
app.get('/',          (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/app.js',    (req, res) => res.sendFile(path.join(__dirname, 'app.js')));
app.use(express.static(__dirname));

// ── API: get all members (summary) ────────────────────────────────
app.get('/api/members', (req, res) => {
  try {
    res.json({ success: true, data: db.getAllMembers() });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── API: get one member detail + transactions ──────────────────────
app.get('/api/member/:name', (req, res) => {
  try {
    const detail = db.getMemberDetail(req.params.name.toLowerCase());
    if (!detail) return res.status(404).json({ success: false, message: 'Member tidak ditemukan' });
    res.json({ success: true, data: detail });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── API: add debt ──────────────────────────────────────────────────
app.post('/api/debt/add', (req, res) => {
  try {
    const { name, amount, description, debt_date } = req.body;
    if (!name || !amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Nama dan jumlah hutang harus diisi' });
    }
    db.addDebt(name.toLowerCase(), Number(amount), description || null, debt_date || null);
    const updated = db.getMemberDetail(name.toLowerCase());
    res.json({
      success: true,
      message: `Hutang ${rpFmt(amount)} berhasil ditambahkan untuk ${capitalize(name)}`,
      data: updated,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── API: add payment (auto-reset jika sudah lunas) ────────────────
app.post('/api/debt/pay', (req, res) => {
  try {
    const { name, amount, description, debt_date } = req.body;
    if (!name || !amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Nama dan jumlah bayar harus diisi' });
    }
    db.addPayment(name.toLowerCase(), Number(amount), description || null, debt_date || null);
    
    // Ambil detail terbaru SETELAH bayar
    let check = db.getMemberDetail(name.toLowerCase());
    
    // Logic Auto-Reset: Jika sisa <= 0, langsung hapus total riwayatnya
    let isNowLunas = (check.remaining <= 0);

    if (isNowLunas) {
      db.resetMember(name.toLowerCase());
      // Ambil data yang sudah bersih (total 0, transactions [])
      check = db.getMemberDetail(name.toLowerCase());
    }

    res.json({
      success: true,
      wasReset: isNowLunas,
      message: isNowLunas
        ? `✅ LUNAS! Semua riwayat hutang ${capitalize(name)} telah dibersihkan otomatis.`
        : `Pembayaran ${rpFmt(amount)} berhasil dicatat.`,
      data: check,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── API: delete transaction ────────────────────────────────────────
app.delete('/api/transaction/:id', (req, res) => {
  try {
    db.deleteTransaction(Number(req.params.id));
    res.json({ success: true, message: 'Transaksi berhasil dihapus' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── API: manual reset member ───────────────────────────────────────
app.post('/api/member/:name/reset', (req, res) => {
  try {
    const name = req.params.name.toLowerCase();
    db.resetMember(name);
    res.json({ success: true, message: `Semua catatan hutang ${capitalize(name)} berhasil direset.` });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Helpers ───────────────────────────────────────────────────────
function rpFmt(n)      { return 'Rp ' + Number(n).toLocaleString('id-ID'); }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏦  Bendahara Tongkrongan`);
  console.log(`    Dashboard : http://localhost:${PORT}`);
  console.log(`    API       : http://localhost:${PORT}/api/members\n`);
});

module.exports = app;
