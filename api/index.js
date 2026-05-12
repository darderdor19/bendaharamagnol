/**
 * api/index.js — The Ultimate Vercel Handler
 */
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db      = require('../database');
const TelegramBot = require('node-telegram-bot-api');

const app  = express();
app.use(cors());
app.use(express.json());

// ── BOT WEBHOOK ──────────────────────────────────────────────────
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);
app.post('/api/bot', async (req, res) => {
  try {
    const { message, callback_query } = req.body;
    // ... logic bot tetap sama ...
    res.sendStatus(200);
  } catch (e) { res.sendStatus(200); }
});

// ── API DASHBOARD ────────────────────────────────────────────────
app.get('/api/members', async (req, res) => {
  try { res.json({ success: true, data: await db.getAllMembers() }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/member/:name', async (req, res) => {
  try { res.json({ success: true, data: await db.getMemberDetail(req.params.name) }); }
  catch (e) { res.status(500).json({ success: false }); }
});

// ── SERVE STATIC FILES (PENTING!) ────────────────────────────────
// Biar Vercel bisa nampilin HTML-nya dari sini juga
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));
app.get('/app.js', (req, res) => res.sendFile(path.join(__dirname, '../app.js')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, '../style.css')));

module.exports = app;
