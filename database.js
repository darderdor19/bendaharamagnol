const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'bendahara.db');
const db = new Database(DB_PATH);

// ── Init tables ───────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id   INTEGER NOT NULL,
    type        TEXT NOT NULL CHECK(type IN ('debt', 'payment')),
    amount      REAL NOT NULL,
    description TEXT,
    debt_date   TEXT,
    created_at  TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (member_id) REFERENCES members(id)
  );
`);

// ── Migrate: tambah kolom baru jika belum ada (aman untuk DB lama) ─
const migrate = [
  `ALTER TABLE transactions ADD COLUMN description TEXT`,
  `ALTER TABLE transactions ADD COLUMN debt_date TEXT`,
];
for (const sql of migrate) {
  try { db.exec(sql); } catch (_) { /* kolom sudah ada, skip */ }
}

// ── Seed members ──────────────────────────────────────────────────
const MEMBERS = ['darderdor', 'diosg', 'nehru', 'firdiads'];
const insertMember = db.prepare(`INSERT OR IGNORE INTO members (name) VALUES (?)`);
for (const m of MEMBERS) insertMember.run(m);

// ── Helpers ───────────────────────────────────────────────────────
function todayStr() {
  return new Date().toLocaleDateString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }); // "12/05/2026"
}

// ── Queries ───────────────────────────────────────────────────────
function getAllMembers() {
  return db.prepare(`
    SELECT
      m.id, m.name,
      COALESCE(SUM(CASE WHEN t.type = 'debt'    THEN t.amount ELSE 0 END), 0) AS total_debt,
      COALESCE(SUM(CASE WHEN t.type = 'payment' THEN t.amount ELSE 0 END), 0) AS total_paid,
      COALESCE(SUM(CASE WHEN t.type = 'debt' THEN t.amount ELSE -t.amount END), 0) AS remaining
    FROM members m
    LEFT JOIN transactions t ON m.id = t.member_id
    GROUP BY m.id
    ORDER BY m.name
  `).all();
}

function getMemberByName(name) {
  return db.prepare(`SELECT * FROM members WHERE name = ?`).get(name);
}

function getMemberDetail(name) {
  const member = getMemberByName(name);
  if (!member) return null;

  const stats = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'debt'    THEN amount ELSE 0 END), 0) AS total_debt,
      COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0) AS total_paid,
      COALESCE(SUM(CASE WHEN type = 'debt' THEN amount ELSE -amount END), 0) AS remaining
    FROM transactions WHERE member_id = ?
  `).get(member.id);

  const transactions = db.prepare(`
    SELECT * FROM transactions
    WHERE member_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(member.id);

  return { ...member, ...stats, transactions };
}

function addDebt(name, amount, description, debtDate) {
  const member = getMemberByName(name);
  if (!member) throw new Error(`Member "${name}" tidak ditemukan`);
  return db.prepare(`
    INSERT INTO transactions (member_id, type, amount, description, debt_date)
    VALUES (?, 'debt', ?, ?, ?)
  `).run(member.id, amount, description || null, debtDate || todayStr());
}

function addPayment(name, amount, description, debtDate) {
  const member = getMemberByName(name);
  if (!member) throw new Error(`Member "${name}" tidak ditemukan`);
  return db.prepare(`
    INSERT INTO transactions (member_id, type, amount, description, debt_date)
    VALUES (?, 'payment', ?, ?, ?)
  `).run(member.id, amount, description || null, debtDate || todayStr());
}

function deleteTransaction(id) {
  return db.prepare(`DELETE FROM transactions WHERE id = ?`).run(id);
}

function resetMember(name) {
  const member = getMemberByName(name);
  if (!member) throw new Error(`Member "${name}" tidak ditemukan`);
  return db.prepare(`DELETE FROM transactions WHERE member_id = ?`).run(member.id);
}

module.exports = {
  getAllMembers, getMemberByName, getMemberDetail,
  addDebt, addPayment, deleteTransaction, resetMember,
};
