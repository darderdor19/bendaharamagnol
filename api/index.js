/**
 * api/index.js — Vercel Entry Point with Persistent State (Supabase)
 */
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const db      = require('../database');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');

const app  = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

function rp(n)  { return 'Rp ' + Number(n).toLocaleString('id-ID'); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── BOT WEBHOOK HANDLER ──────────────────────────────────────────
app.post('/api/bot', async (req, res) => {
  try {
    const { message, callback_query } = req.body;

    // --- HANDLE CALLBACK (TOMBOL) ---
    if (callback_query) {
      const chatId = callback_query.message.chat.id;
      const data = callback_query.data;
      await bot.answerCallbackQuery(callback_query.id);

      if (data.startsWith('mb:')) {
        const m = data.slice(3);
        const d = await db.getMemberDetail(m);
        await bot.sendMessage(chatId, `👤 *${cap(m)}*\n💰 Hutang: ${rp(d.total_debt)}\n💵 Bayar: ${rp(d.total_paid)}\n─────────────────\n📌 Sisa: *${rp(d.remaining)}*`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [
            [{ text: '💸 Tambah Hutang', callback_data: `act:debt:${m}` }, { text: '✅ Bayar Hutang', callback_data: `act:pay:${m}` }],
            [{ text: '🔙 Kembali', callback_data: 'start' }]
          ]}
        });
      }

      if (data.startsWith('act:')) {
        const [, action, m] = data.split(':');
        // Simpan status ke Supabase
        await supabase.from('bot_state').upsert({ chat_id: chatId, member: m, action, step: 'amount' });
        await bot.sendMessage(chatId, `💬 *Masukkan jumlah* untuk *${cap(m)}*:\n_(Contoh: 50000)_`, { parse_mode: 'Markdown' });
      }

      if (data === 'start') {
        await supabase.from('bot_state').delete().eq('chat_id', chatId);
        await bot.sendMessage(chatId, '🏦 *Bendahara Tongkrongan*\n\nPilih member:', {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [
            [{ text: '👤 Darderdor', callback_data: 'mb:darderdor' }, { text: '👤 Diosg', callback_data: 'mb:diosg' }],
            [{ text: '👤 Nehru', callback_data: 'mb:nehru' }, { text: '👤 Firdiads', callback_data: 'mb:firdiads' }]
          ]}
        });
      }
    }

    // --- HANDLE PESAN TEKS ---
    if (message && message.text) {
      const chatId = message.chat.id;
      const text = message.text;

      if (text === '/start') {
        await supabase.from('bot_state').delete().eq('chat_id', chatId);
        return await bot.sendMessage(chatId, '🏦 *Bendahara Tongkrongan*\n\nPilih member:', {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [
            [{ text: '👤 Darderdor', callback_data: 'mb:darderdor' }, { text: '👤 Diosg', callback_data: 'mb:diosg' }],
            [{ text: '👤 Nehru', callback_data: 'mb:nehru' }, { text: '👤 Firdiads', callback_data: 'mb:firdiads' }]
          ]}
        });
      }

      // Cek apakah user sedang dalam proses input (ambil status dari Supabase)
      const { data: state } = await supabase.from('bot_state').select('*').eq('chat_id', chatId).single();

      if (state) {
        if (state.step === 'amount') {
          const val = parseInt(text.replace(/[^\d]/g,''), 10);
          if (!val) return await bot.sendMessage(chatId, '❌ Masukkan angka saja bro!');
          await supabase.from('bot_state').update({ amount: val, step: 'description' }).eq('chat_id', chatId);
          return await bot.sendMessage(chatId, `📝 *Keterangan?*\n_(Ketik alasan hutang atau 'skip')_`, { parse_mode: 'Markdown' });
        }

        if (state.step === 'description') {
          const desc = text.toLowerCase() === 'skip' ? null : text;
          const { member, action, amount } = state;
          
          // Simpan ke Database Utama!
          if (action === 'debt') await db.addDebt(member, amount, desc, new Date().toLocaleDateString('id-ID'));
          else {
             await db.addPayment(member, amount, desc, new Date().toLocaleDateString('id-ID'));
             const upd = await db.getMemberDetail(member);
             if (upd.remaining <= 0) await db.resetMember(member);
          }

          // Hapus status kalau sudah beres
          await supabase.from('bot_state').delete().eq('chat_id', chatId);
          
          const final = await db.getMemberDetail(member);
          return await bot.sendMessage(chatId, `✅ *Berhasil Dicatat!*\n\nMember: ${cap(member)}\nJumlah: ${rp(amount)}\nSisa: ${final.remaining <= 0 ? 'LUNAS' : rp(final.remaining)}`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Menu', callback_data: 'start' }]] }
          });
        }
      }
    }

    res.sendStatus(200);
  } catch (e) {
    console.error('Bot error:', e);
    res.sendStatus(200);
  }
});

// ── API DASHBOARD (Tetap Sama) ────────────────────────────────────
app.get('/api/members', async (req, res) => {
  try { res.json({ success: true, data: await db.getAllMembers() }); }
  catch (e) { res.status(500).json({ success: false }); }
});

module.exports = app;
