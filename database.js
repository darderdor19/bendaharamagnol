/**
 * database.js — Supabase Version
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL atau SUPABASE_KEY tidak ditemukan di .env!');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper: Ambil ID member berdasarkan nama
async function getMemberId(name) {
  const { data, error } = await supabase
    .from('members')
    .select('id')
    .eq('name', name.toLowerCase())
    .single();
  if (error || !data) return null;
  return data.id;
}

const db = {
  // Ambil semua member (summary)
  async getAllMembers() {
    const { data: members } = await supabase.from('members').select('*');
    const results = [];
    for (const m of members) {
      const detail = await this.getMemberDetail(m.name);
      results.push(detail);
    }
    return results;
  },

  // Ambil detail satu member + transaksi
  async getMemberDetail(name) {
    const memberId = await getMemberId(name);
    if (!memberId) return { name, total_debt: 0, total_paid: 0, remaining: 0, history: [] };

    const { data: trans } = await supabase
      .from('transactions')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false });

    const debts = (trans || []).filter(t => t.type === 'debt').reduce((s, t) => s + t.amount, 0);
    const paid  = (trans || []).filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0);

    return {
      name,
      total_debt: debts,
      total_paid: paid,
      remaining: debts - paid,
      history: trans || []
    };
  },

  // Tambah Hutang
  async addDebt(name, amount, description, debt_date) {
    const memberId = await getMemberId(name);
    return await supabase.from('transactions').insert({
      member_id: memberId,
      type: 'debt',
      amount,
      description,
      debt_date
    });
  },

  // Tambah Pembayaran
  async addPayment(name, amount, description, debt_date) {
    const memberId = await getMemberId(name);
    return await supabase.from('transactions').insert({
      member_id: memberId,
      type: 'payment',
      amount,
      description,
      debt_date
    });
  },

  // Hapus Transaksi
  async deleteTransaction(id) {
    return await supabase.from('transactions').delete().eq('id', id);
  },

  // Reset Member (Hapus semua riwayat - AKTIF KEMBALI)
  async resetMember(name) {
    const memberId = await getMemberId(name);
    return await supabase.from('transactions').delete().eq('member_id', memberId);
  }
};

module.exports = db;
