/**
 * api/index.js — Main Vercel Entry Point
 */
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const db      = require('../database');
const TelegramBot = require('node-telegram-bot-api');

const app  = express();
app.use(cors());
app.use(express.json());

const TOKEN = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(TOKEN);

// ── BOT WEBHOOK HANDLER ──────────────────────────────────────────
// Ini fungsi biar Bot lo bisa nerima chat di Vercel
app.post('/api/bot', async (req, res) => {
  try {
    const { message, callback_query } = req.body;
    
    // Handle Pesan Teks
    if (message) {
      const chatId = message.chat.id;
      const text = message.text;
      if (text === '/start') {
        await bot.sendMessage(chatId, '🏦 *Bendahara Tongkrongan Online*\n\nPilih member:', {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [
            [{ text: '👤 Darderdor', callback_data: 'mb:darderdor' }, { text: '👤 Diosg', callback_data: 'mb:diosg' }],
            [{ text: '👤 Nehru', callback_data: 'mb:nehru' }, { text: '👤 Firdiads', callback_data: 'mb:firdiads' }]
          ]}
        });
      }
    }

    // Handle Klik Tombol (Callback)
    if (callback_query) {
      const chatId = callback_query.message.chat.id;
      const data = callback_query.data;
      if (data.startsWith('mb:')) {
        const member = data.slice(3);
        const d = await db.getMemberDetail(member);
        await bot.sendMessage(chatId, `👤 *${member.toUpperCase()}*\n💰 Hutang: Rp ${Number(d.total_debt).toLocaleString('id-ID')}\n📌 Sisa: Rp ${Number(d.remaining).toLocaleString('id-ID')}`, { parse_mode: 'Markdown' });
      }
    }

    res.sendStatus(200);
  } catch (e) {
    console.error('Bot error:', e);
    res.sendStatus(200);
  }
});

// ── DASHBOARD API ────────────────────────────────────────────────
app.get('/api/members', async (req, res) => {
  try {
    const data = await db.getAllMembers();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/member/:name', async (req, res) => {
  try {
    const detail = await db.getMemberDetail(req.params.name.toLowerCase());
    res.json({ success: true, data: detail });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/debt/add', async (req, res) => {
  try {
    const { name, amount, description, debt_date } = req.body;
    await db.addDebt(name, amount, description, debt_date);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.post('/api/debt/pay', async (req, res) => {
  try {
    const { name, amount, description, debt_date } = req.body;
    await db.addPayment(name, amount, description, debt_date);
    let check = await db.getMemberDetail(name);
    if (check.remaining <= 0) await db.resetMember(name);
    res.json({ success: true, wasReset: (check.remaining <= 0) });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

module.exports = app;
