require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db      = require('./database');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ── Static files ──────────────────────────────────────────────────
app.get('/',          (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/app.js',    (req, res) => res.sendFile(path.join(__dirname, 'app.js')));
app.use(express.static(__dirname));

// ── API: get all members ──────────────────────────────────────────
app.get('/api/members', async (req, res) => {
  try {
    const data = await db.getAllMembers();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── API: get member detail ────────────────────────────────────────
app.get('/api/member/:name', async (req, res) => {
  try {
    const detail = await db.getMemberDetail(req.params.name.toLowerCase());
    if (!detail) return res.status(404).json({ success: false, message: 'Member tidak ditemukan' });
    res.json({ success: true, data: detail });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── API: add debt ─────────────────────────────────────────────────
app.post('/api/debt/add', async (req, res) => {
  try {
    const { name, amount, description, debt_date } = req.body;
    if (!name || !amount || isNaN(amount)) return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    
    await db.addDebt(name.toLowerCase(), Number(amount), description, debt_date);
    const updated = await db.getMemberDetail(name.toLowerCase());
    res.json({ success: true, message: `Hutang berhasil dicatat`, data: updated });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── API: add payment (auto-reset) ─────────────────────────────────
app.post('/api/debt/pay', async (req, res) => {
  try {
    const { name, amount, description, debt_date } = req.body;
    if (!name || !amount || isNaN(amount)) return res.status(400).json({ success: false, message: 'Data tidak lengkap' });

    await db.addPayment(name.toLowerCase(), Number(amount), description, debt_date);
    let check = await db.getMemberDetail(name.toLowerCase());
    
    let isNowLunas = (check.remaining <= 0);
    if (isNowLunas) {
      await db.resetMember(name.toLowerCase());
      check = await db.getMemberDetail(name.toLowerCase());
    }

    res.json({
      success: true,
      wasReset: isNowLunas,
      message: isNowLunas ? `✅ LUNAS! Riwayat dibersihkan.` : `Pembayaran dicatat.`,
      data: check
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── API: delete transaction ───────────────────────────────────────
app.delete('/api/transaction/:id', async (req, res) => {
  try {
    await db.deleteTransaction(Number(req.params.id));
    res.json({ success: true, message: 'Transaksi dihapus' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🏦 Server online di port ${PORT}`);
});
