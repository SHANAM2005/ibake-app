const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'ibake.db'));
db.pragma('journal_mode = WAL');

// ---------- Schema ----------
db.exec(`
CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'Cakes',
  image TEXT DEFAULT '',
  is_available INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_ref TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  items_json TEXT NOT NULL,
  total REAL NOT NULL,
  payment_screenshot TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

// ---------- Seed default admin user (only if none exists) ----------
const adminCount = db.prepare('SELECT COUNT(*) as c FROM admin_users').get().c;
if (adminCount === 0) {
  const defaultUser = process.env.ADMIN_USERNAME || 'admin';
  const defaultPass = process.env.ADMIN_PASSWORD || 'ibake2026';
  const hash = bcrypt.hashSync(defaultPass, 10);
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(defaultUser, hash);
  console.log(`[setup] Created default admin user "${defaultUser}" — change the password after first login.`);
}

// ---------- Seed default settings ----------
const defaultSettings = {
  bakery_name: 'iBake',
  whatsapp_number: '919596459797',
  upi_id: 'ibake@upi',
  currency_symbol: '\u20b9'
};
const settingCount = db.prepare('SELECT COUNT(*) as c FROM settings').get().c;
if (settingCount === 0) {
  const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaultSettings)) insert.run(k, v);
}

module.exports = db;
