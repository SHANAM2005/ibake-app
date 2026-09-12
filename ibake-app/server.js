require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'ibake-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 hour admin session
}));

// ---------- File upload setup (payment screenshots) ----------
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = /\.(jpg|jpeg|png|webp)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only JPG, PNG or WEBP images are allowed'), ok);
  }
});

// ---------- Email setup (optional, only sends if env vars are configured) ----------
let transporter = null;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
} else {
  console.log('[email] SMTP_USER / SMTP_PASS not set in .env \u2014 order emails are disabled until configured.');
}

function sendOrderEmail(order) {
  if (!transporter) return;
  const to = process.env.NOTIFY_EMAIL || process.env.SMTP_USER;
  const items = JSON.parse(order.items_json);
  const itemLines = items.map(i => `  \u2022 ${i.name} x${i.qty} \u2014 \u20b9${i.price * i.qty}`).join('\n');
  transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject: `New order ${order.order_ref} \u2014 \u20b9${order.total}`,
    text: `New order received!\n\nOrder ref: ${order.order_ref}\nCustomer: ${order.customer_name}\nPhone: ${order.customer_phone}\nAddress: ${order.customer_address}\n\nItems:\n${itemLines}\n\nTotal: \u20b9${order.total}\n\nView it in the admin dashboard to see the payment screenshot.`
  }).catch(err => console.error('[email] Failed to send order email:', err.message));
}

// =========================================================
// PUBLIC API \u2014 menu + orders (no login required for customers)
// =========================================================

app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json(settings);
});

app.get('/api/menu', (req, res) => {
  const items = db.prepare('SELECT * FROM menu_items WHERE is_available = 1 ORDER BY sort_order ASC, id ASC').all();
  res.json(items);
});

app.post('/api/orders', upload.single('screenshot'), (req, res) => {
  try {
    const { customer_name, customer_phone, customer_address, items, total } = req.body;
    if (!customer_name || !customer_phone || !customer_address || !items || !total) {
      return res.status(400).json({ error: 'Missing required order details.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Payment screenshot is required.' });
    }
    const orderRef = 'IB' + Date.now().toString().slice(-8);
    const screenshotPath = '/uploads/' + req.file.filename;

    db.prepare(`
      INSERT INTO orders (order_ref, customer_name, customer_phone, customer_address, items_json, total, payment_screenshot, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(orderRef, customer_name, customer_phone, customer_address, items, parseFloat(total), screenshotPath);

    const order = db.prepare('SELECT * FROM orders WHERE order_ref = ?').get(orderRef);
    sendOrderEmail(order);

    res.json({ success: true, order_ref: orderRef });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong placing your order.' });
  }
});

// =========================================================
// ADMIN AUTH
// =========================================================

function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  req.session.adminId = user.id;
  res.json({ success: true });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/admin/me', (req, res) => {
  res.json({ loggedIn: !!(req.session && req.session.adminId) });
});

app.post('/api/admin/change-password', requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.session.adminId);
  if (!bcrypt.compareSync(currentPassword || '', user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  res.json({ success: true });
});

// =========================================================
// ADMIN API \u2014 menu management
// =========================================================

const menuImageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'images')),
    filename: (req, file, cb) => {
      const unique = 'item-' + Date.now() + path.extname(file.originalname);
      cb(null, unique);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(jpg|jpeg|png|webp)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only JPG, PNG or WEBP images are allowed'), ok);
  }
});

app.get('/api/admin/menu', requireAdmin, (req, res) => {
  const items = db.prepare('SELECT * FROM menu_items ORDER BY sort_order ASC, id ASC').all();
  res.json(items);
});

app.post('/api/admin/menu', requireAdmin, menuImageUpload.single('image'), (req, res) => {
  const { name, description, price, category } = req.body;
  if (!name || !price || !category) return res.status(400).json({ error: 'Name, price and category are required.' });
  const image = req.file ? req.file.filename : (req.body.existingImage || '');
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM menu_items').get().m;
  const info = db.prepare(`
    INSERT INTO menu_items (name, description, price, category, image, is_available, sort_order)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(name, description || '', parseFloat(price), category, image, maxOrder + 1);
  res.json({ success: true, id: info.lastInsertRowid });
});

app.put('/api/admin/menu/:id', requireAdmin, menuImageUpload.single('image'), (req, res) => {
  const { name, description, price, category, is_available } = req.body;
  const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item not found' });
  const image = req.file ? req.file.filename : existing.image;
  db.prepare(`
    UPDATE menu_items SET name=?, description=?, price=?, category=?, image=?, is_available=?
    WHERE id=?
  `).run(
    name ?? existing.name,
    description ?? existing.description,
    price !== undefined ? parseFloat(price) : existing.price,
    category ?? existing.category,
    image,
    is_available !== undefined ? (is_available === 'true' || is_available === true || is_available === '1' ? 1 : 0) : existing.is_available,
    req.params.id
  );
  res.json({ success: true });
});

app.delete('/api/admin/menu/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// =========================================================
// ADMIN API \u2014 orders
// =========================================================

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  res.json(orders);
});

app.put('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  if (!['pending', 'confirmed', 'fulfilled', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// =========================================================
// ADMIN API \u2014 settings (WhatsApp number, UPI id, bakery name)
// =========================================================

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  for (const [k, v] of Object.entries(req.body)) upsert.run(k, String(v));
  res.json({ success: true });
});

// =========================================================
// Page routes
// =========================================================

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin-login.html'));
});
app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin-dashboard.html'));
});

app.listen(PORT, () => {
  console.log(`\niBake server running at http://localhost:${PORT}`);
  console.log(`Admin login at http://localhost:${PORT}/admin\n`);
});
