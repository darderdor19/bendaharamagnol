/**
 * api/index.js — Perfect Reset Logic (Reset only if exactly 0)
 */
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db      = require('../database');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');

const app  = express();
app.use(cors());
app.use(express.json());

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: false });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function rp(n)  { 
  const val = Math.abs(n);
  return (n < 0 ? '+ ' : '') + 'Rp ' + Number(val).toLocaleString('id-ID'); 
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

app.post('/api/bot', async (req, res) => {
  try {
    const { message, callback_query } = req.body;
    
    if (callback_query) {
      const chatId = callback_query.message.chat.id;
      const data = callback_query.data;
      await bot.answerCallbackQuery(callback_query.id);
      
      if (data.startsWith('mb:')) {
        const m = data.slice(3);
        const d = await db.getMemberDetail(m);
        const isSaldo = d.remaining < 0;
        const statusLabel = isSaldo ? '💰 *Deposit Saldo*' : '📌 *Sisa Hutang*';

        let historyTxt = '\n📖 *Rincian Terakhir:*\n';
        if (d.history && d.history.length > 0) {
          d.history.slice(0, 10).forEach(h => {
            const icon = h.type === 'debt' ? '🔴' : '🟢';
            historyTxt += `${icon} *${rp(h.amount)}* - ${h.description || '...'}\n   _( ${h.debt_date || ''} )_\n`;
          });
        } else { historyTxt += '✨ _Belum ada riwayat._'; }

        await bot.sendMessage(chatId, `👤 *${cap(m)}*\n─────────────────\n${statusLabel}: *${d.remaining === 0 ? 'LUNAS' : rp(d.remaining)}*\n${historyTxt}\n_(🔴: Hutang, 🟢: Bayar)_`, {
          parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '💸 Tambah Hutang', callback_data: `act:debt:${m}` }, { text: '✅ Bayar Hutang', callback_data: `act:pay:${m}` }],[{ text: '🔙 Kembali', callback_data: 'start' }]] }
        });
      }
      else if (data === 'rekap_semua') {
        const members = await db.getAllMembers();
        let txt = '📊 *REKAP SEMUA MEMBER*\n─────────────────\n';
        for (const m of members) {
          const isSaldo = m.remaining < 0;
          const status = m.remaining === 0 ? '✅ *LUNAS*' : `*${rp(m.remaining)}* ${isSaldo ? '(Saldo)' : ''}`;
          txt += `👤 *${cap(m.name)}* : ${status}\n`;
          const detail = await db.getMemberDetail(m.name);
          if (detail.history && detail.history.length > 0) {
            detail.history.slice(0, 3).forEach(h => {
              txt += `   ${h.type === 'debt' ? '🔴' : '🟢'} ${h.description || '...'}: ${rp(h.amount)}\n`;
            });
          }
          txt += '\n';
        }
        await bot.sendMessage(chatId, txt, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'start' }]] } });
      }
      else if (data.startsWith('act:')) {
        const [, action, m] = data.split(':');
        await supabase.from('bot_state').upsert({ chat_id: chatId, member: m, action, step: 'amount' });
        await bot.sendMessage(chatId, `💬 *Masukkan jumlah* untuk *${cap(m)}*:`, { parse_mode: 'Markdown' });
      }
      else if (data === 'start') {
        await supabase.from('bot_state').delete().eq('chat_id', chatId);
        await bot.sendMessage(chatId, '🏦 *Bendahara Tongkrongan*\n\nPilih member atau buka dashboard:', {
          parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
            [{ text: '👤 Darderdor', callback_data: 'mb:darderdor' }, { text: '👤 Diosg', callback_data: 'mb:diosg' }],
            [{ text: '👤 Nehru', callback_data: 'mb:nehru' }, { text: '👤 Firdiads', callback_data: 'mb:firdiads' }],
            [{ text: '👤 Kak Nadine', callback_data: 'mb:nadine' }, { text: '👤 Bang Ogut', callback_data: 'mb:ogut' }],
            [{ text: '👤 Scott', callback_data: 'mb:scott' }, { text: '👤 Ramdjar', callback_data: 'mb:ramdjar' }],
            [{ text: '👤 Ares', callback_data: 'mb:ares' }],
            [{ text: '📊 Rekap Semua Member', callback_data: 'rekap_semua' }],
            [{ text: '🌐 Buka Dashboard Web', url: 'https://bendaharamagnol.vercel.app/' }]
          ] }
        });
      }
    }

    if (message && message.text) {
      const chatId = message.chat.id;
      const text = message.text;
      if (text === '/start') {
        await supabase.from('bot_state').delete().eq('chat_id', chatId);
        await bot.sendMessage(chatId, '🏦 *Bendahara Tongkrongan*\n\nPilih member atau buka dashboard:', {
          parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
            [{ text: '👤 Darderdor', callback_data: 'mb:darderdor' }, { text: '👤 Diosg', callback_data: 'mb:diosg' }],
            [{ text: '👤 Nehru', callback_data: 'mb:nehru' }, { text: '👤 Firdiads', callback_data: 'mb:firdiads' }],
            [{ text: '👤 Kak Nadine', callback_data: 'mb:nadine' }, { text: '👤 Bang Ogut', callback_data: 'mb:ogut' }],
            [{ text: '👤 Scott', callback_data: 'mb:scott' }, { text: '👤 Ramdjar', callback_data: 'mb:ramdjar' }],
            [{ text: '👤 Ares', callback_data: 'mb:ares' }],
            [{ text: '📊 Rekap Semua Member', callback_data: 'rekap_semua' }],
            [{ text: '🌐 Buka Dashboard Web', url: 'https://bendaharamagnol.vercel.app/' }]
          ] }
        });
      } else {
        const { data: state } = await supabase.from('bot_state').select('*').eq('chat_id', chatId).single();
        if (state) {
          if (state.step === 'amount') {
            const val = parseInt(text.replace(/[^\d]/g,''), 10);
            if (!val) { await bot.sendMessage(chatId, '❌ Angka saja!'); }
            else {
              await supabase.from('bot_state').update({ amount: val, step: 'description' }).eq('chat_id', chatId);
              await bot.sendMessage(chatId, `📝 *Keterangan?* (atau 'skip')`);
            }
          }
          else if (state.step === 'description') {
            const desc = text.toLowerCase() === 'skip' ? null : text;
            if (state.action === 'debt') {
              await db.addDebt(state.member, state.amount, desc, new Date().toLocaleDateString('id-ID'));
            } else {
              await db.addPayment(state.member, state.amount, desc, new Date().toLocaleDateString('id-ID'));
            }
            
            // --- LOGIKA PERFECT RESET ---
            const check = await db.getMemberDetail(state.member);
            let resetNotif = '';
            if (check.remaining === 0) {
              await db.resetMember(state.member);
              resetNotif = '\n\n✨ *Riwayat dibersihkan (Lunas Sempurna!)*';
            }

            await supabase.from('bot_state').delete().eq('chat_id', chatId);
            const final = await db.getMemberDetail(state.member);
            const isSaldo = final.remaining < 0;
            const resMsg = isSaldo ? `💰 *Deposit Saldo: ${rp(final.remaining)}*` : `📌 *Sisa Hutang: ${final.remaining === 0 ? 'LUNAS' : rp(final.remaining)}*`;
            
            await bot.sendMessage(chatId, `✅ *Berhasil!*\n\nMember: ${cap(state.member)}\n${resMsg}${resetNotif}`, {
              parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Menu Utama', callback_data: 'start' }]] }
            });
          }
        }
      }
    }
  } catch (e) { console.error('❌ BOT ERROR:', e.message); }
  finally { res.status(200).json({ ok: true }); }
});

app.get('/api/members', async (req, res) => {
  try { res.json({ success: true, data: await db.getAllMembers() }); }
  catch (e) { res.status(500).json({ success: false }); }
});
app.get('/api/member/:name', async (req, res) => {
  try { res.json({ success: true, data: await db.getMemberDetail(req.params.name) }); }
  catch (e) { res.status(500).json({ success: false }); }
});
app.post('/api/debt/add', async (req, res) => {
  try {
    const { name, amount, description, debt_date } = req.body;
    await db.addDebt(name, amount, description, debt_date);
    // Reset juga di Web API kalau pas 0
    const check = await db.getMemberDetail(name);
    if (check.remaining === 0) await db.resetMember(name);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});
app.post('/api/debt/pay', async (req, res) => {
  try {
    const { name, amount, description, debt_date } = req.body;
    await db.addPayment(name, amount, description, debt_date);
    // Reset juga di Web API kalau pas 0
    const check = await db.getMemberDetail(name);
    if (check.remaining === 0) await db.resetMember(name);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));
app.get('/app.js', (req, res) => res.sendFile(path.join(__dirname, '../app.js')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, '../style.css')));
module.exports = app;
