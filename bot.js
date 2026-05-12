/**
 * bot.js — Bendahara Tongkrongan Telegram Bot
 */
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');

const TOKEN = process.env.TELEGRAM_TOKEN;
if (!TOKEN) { console.error('❌ TELEGRAM_TOKEN tidak ada di .env!'); process.exit(1); }

const bot = new TelegramBot(TOKEN, { polling: true });

const STATE = {};
const MEMBERS = ['darderdor', 'diosg', 'nehru', 'firdiads'];

function rp(n)  { return 'Rp ' + Number(n).toLocaleString('id-ID'); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function todayLabel() { return new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }); }

function parseDate(input) {
  const s = (input || '').trim();
  if (!s || s.toLowerCase() === 'skip' || s.toLowerCase() === 'hari ini') return todayLabel();
  const parts = s.split('/');
  if (parts.length === 2) return `${parts[0].padStart(2,'0')}/${parts[1].padStart(2,'0')}/${new Date().getFullYear()}`;
  if (parts.length === 3) return `${parts[0].padStart(2,'0')}/${parts[1].padStart(2,'0')}/${parts[2]}`;
  const dashes = s.split('-');
  if (dashes.length === 3) return `${dashes[0].padStart(2,'0')}/${dashes[1].padStart(2,'0')}/${dashes[2]}`;
  return s;
}

// ── Status & History Helpers ─────────────────────────────────────
function calcStatus(transactions) {
  const debts = [...(transactions||[]).filter(t=>t.type==='debt')].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  let paid = (transactions||[]).filter(t=>t.type==='payment').reduce((s,t)=>s+t.amount, 0);
  const map = {};
  for (const d of debts) {
    if (paid >= d.amount) { map[d.id]='lunas'; paid -= d.amount; }
    else { map[d.id]='belum'; }
  }
  return map;
}

function memberStatusText(name) {
  const d = db.getMemberDetail(name);
  if (!d) return `Member "${name}" tidak ditemukan.`;
  const sisa = d.remaining;
  return [
    `👤 *${cap(name)}*`, '',
    `💰 Total Hutang : ${rp(d.total_debt)}`,
    `💵 Sudah Bayar  : ${rp(d.total_paid)}`,
    `─────────────────`,
    sisa <= 0 ? '✅ *LUNAS*' : `⚠️ Sisa: *${rp(sisa)}*`,
  ].join('\n');
}

function historyText(name) {
  const d = db.getMemberDetail(name);
  if (!d) return `Member tidak ditemukan.`;
  const lines = [`📋 *Daftar Hutang — ${cap(name)}*`, '─────────────────'];
  const debtItems = (d.transactions||[]).filter(t=>t.type==='debt');
  const statusMap = calcStatus(d.transactions||[]);
  if (debtItems.length === 0) {
    lines.push('_Belum ada catatan hutang_');
  } else {
    debtItems.forEach(t => {
      const s = statusMap[t.id]==='lunas' ? '✅ Lunas' : '🔴 Belum';
      lines.push(`${s} *${rp(t.amount)}*`);
      lines.push(`   📅 ${t.debt_date||'–'}  |  📝 ${t.description||'–'}`);
    });
  }
  const payItems = (d.transactions||[]).filter(t=>t.type==='payment');
  if (payItems.length > 0) {
    lines.push('', '💵 *Riwayat Pembayaran:*');
    payItems.forEach(t => lines.push(`✅ ${rp(t.amount)} — ${t.debt_date||'–'}${t.description?' | '+t.description:''}`));
  }
  lines.push('', '─────────────────', `📌 Sisa: *${d.remaining<=0?'LUNAS':rp(d.remaining)}*`);
  return lines.join('\n');
}

// ── Keyboards ─────────────────────────────────────────────────────
function kbMembers() {
  return { inline_keyboard: [
    [{ text: '👤 Darderdor', callback_data: 'mb:darderdor' }, { text: '👤 Diosg', callback_data: 'mb:diosg' }],
    [{ text: '👤 Nehru', callback_data: 'mb:nehru' }, { text: '👤 Firdiads', callback_data: 'mb:firdiads' }],
    [{ text: '📊 Rekap Semua', callback_data: 'rekap' }]
  ]};
}

function kbActions(member) {
  const d = db.getMemberDetail(member);
  const hasTx = (d?.transactions?.length || 0) > 0;
  const rows = [
    [{ text: '💸 Tambah Hutang', callback_data: `act:debt:${member}` }, { text: '✅ Bayar Hutang', callback_data: `act:pay:${member}` }],
    [{ text: '📋 Lihat Riwayat', callback_data: `act:history:${member}` }]
  ];
  if (hasTx && d.remaining <= 0) rows.push([{ text: '🔄 Reset Data (Lunas)', callback_data: `act:reset:${member}` }]);
  rows.push([{ text: '🔙 Pilih Member Lain', callback_data: 'back' }]);
  return { inline_keyboard: rows };
}

function kbCancel(member) { return { inline_keyboard: [[{ text: '❌ Batal', callback_data: `mb:${member}` }]] }; }

// ── Message Helpers ───────────────────────────────────────────────
async function sendMsg(chatId, text, opts = {}) {
  try { return await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...opts }); }
  catch (e) { return bot.sendMessage(chatId, text.replace(/[*_`]/g,''), opts); }
}

async function editMsg(chatId, msgId, text, opts = {}) {
  try { return await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...opts }); }
  catch (e) { if (!e.message?.includes('not modified')) console.error('edit error'); }
}

// ── Event Handlers ────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  STATE[msg.chat.id] = {};
  sendMsg(msg.chat.id, '🏦 *Bendahara Tongkrongan*\n\nHalo! Pilih member:', { reply_markup: kbMembers() });
});

bot.on('callback_query', async (q) => {
  const chatId = q.message.chat.id;
  const msgId = q.message.message_id;
  const data = q.data;
  bot.answerCallbackQuery(q.id).catch(()=>{});

  try {
    if (data === 'back') { STATE[chatId] = {}; return editMsg(chatId, msgId, '🏦 *Bendahara Tongkrongan*\n\nPilih member:', { reply_markup: kbMembers() }); }
    if (data === 'rekap') {
      const all = db.getAllMembers();
      let txt = '🏦 *Rekap Hutang Semua Member*\n─────────────────\n';
      all.forEach(m => txt += `${m.remaining<=0?'✅':'🔴'} *${cap(m.name)}*: ${m.remaining<=0?'Lunas':rp(m.remaining)}\n`);
      return editMsg(chatId, msgId, txt, { reply_markup: kbMembers() });
    }
    if (data.startsWith('mb:')) {
      const m = data.slice(3);
      STATE[chatId] = { member: m };
      return editMsg(chatId, msgId, memberStatusText(m) + '\n\n🎯 Pilih aksi:', { reply_markup: kbActions(m) });
    }
    if (data.startsWith('act:')) {
      const [, action, m] = data.split(':');
      if (action === 'history') return editMsg(chatId, msgId, historyText(m), { reply_markup: kbActions(m) });
      if (action === 'reset') return editMsg(chatId, msgId, `⚠️ *Reset Hutang ${cap(m)}?*\n\nSemua catatan akan dihapus permanen.`, {
        reply_markup: { inline_keyboard: [[{ text: '✅ Ya, Reset!', callback_data: `conf_res:${m}` }], [{ text: '❌ Batal', callback_data: `mb:${m}` }]] }
      });
      STATE[chatId] = { member: m, action, step: 'amount' };
      return editMsg(chatId, msgId, `💬 *Masukkan jumlah* untuk *${cap(m)}*:\n\n_Contoh: 50000_`, { reply_markup: kbCancel(m) });
    }
    if (data.startsWith('conf_res:')) {
      const m = data.split(':')[1];
      db.resetMember(m);
      return editMsg(chatId, msgId, `🎉 *Data ${cap(m)} berhasil direset!*`, { reply_markup: kbActions(m) });
    }
  } catch (e) { sendMsg(chatId, `❌ Error: ${e.message}`); }
});

bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const chatId = msg.chat.id;
  const state = STATE[chatId];
  if (!state?.step) return;

  try {
    if (state.step === 'amount') {
      const val = parseInt(msg.text.replace(/[^\d]/g,''), 10);
      if (!val || val <= 0) return sendMsg(chatId, '❌ Angka tidak valid. Masukkan angka saja.');
      STATE[chatId].amount = val;
      STATE[chatId].step = 'description';
      return sendMsg(chatId, `📝 *Keterangan/Hutang Apa?*\n\n_Ketik keterangan atau 'skip'_`, { reply_markup: kbCancel(state.member) });
    }
    if (state.step === 'description') {
      STATE[chatId].description = msg.text.toLowerCase() === 'skip' ? null : msg.text;
      STATE[chatId].step = 'date';
      return sendMsg(chatId, `📅 *Tanggal berapa?* (DD/MM)\n\n_Ketik tanggal atau 'skip' (hari ini)_`, { reply_markup: kbCancel(state.member) });
    }
    if (state.step === 'date') {
      const { member, action, amount, description } = state;
      const dDate = parseDate(msg.text);
      if (action === 'debt') db.addDebt(member, amount, description, dDate);
      else db.addPayment(member, amount, description, dDate);

      const upd = db.getMemberDetail(member);
      
      // Auto-Reset di Bot
      if (upd.remaining <= 0 && action === 'pay') {
        db.resetMember(member);
        STATE[chatId] = {};
        return sendMsg(chatId, `🎉 *${cap(member)} LUNAS!*\n\nSemua riwayat hutang telah dibersihkan otomatis. Siap buat catatan baru!`, { reply_markup: kbActions(member) });
      }

      STATE[chatId] = {};
      return sendMsg(chatId, `✅ *Berhasil dicatat!*\n\nMember: ${cap(member)}\nJumlah: ${rp(amount)}\nSisa: ${upd.remaining<=0?'Lunas':rp(upd.remaining)}`, { reply_markup: kbActions(member) });
    }
  } catch (e) { STATE[chatId]={}; sendMsg(chatId, `❌ Error: ${e.message}`, { reply_markup: kbMembers() }); }
});

console.log('🤖 Bot Bendahara Tongkrongan aktif!');
