require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { supabase, uploadToBucket, MENU_BUCKET, SCREENSHOT_BUCKET } = require('./db');

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

// ---------- File upload setup (in-memory, then pushed to Supabase Storage) ----------
const upload = multer({
  storage: multer.memoryStorage(),
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

function dbErr(res, error, fallbackMsg) {
  console.error(error);
  return res.status(500).json({ error: fallbackMsg || error.message || 'Something went wrong.' });
}

// =========================================================
// PUBLIC API \u2014 menu + orders (no login required for customers)
// =========================================================

app.get('/api/settings', async (req, res) => {
  const { data, error } = await supabase.from('settings').select('key, value');
  if (error) return dbErr(res, error);
  res.json(Object.fromEntries(data.map(r => [r.key, r.value])));
});

app.get('/api/menu', async (req, res) => {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('is_available', true)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });
  if (error) return dbErr(res, error);
  res.json(data);
});

app.post('/api/orders', upload.single('screenshot'), async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_address, items, total } = req.body;
    if (!customer_name || !customer_phone || !customer_address || !items || !total) {
      return res.status(400).json({ error: 'Missing required order details.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Payment screenshot is required.' });
    }

    const orderRef = 'IB' + Date.now().toString().slice(-8);
    const filename = `${orderRef}-${Date.now()}${path.extname(req.file.originalname)}`;
    const screenshotUrl = await uploadToBucket(SCREENSHOT_BUCKET, filename, req.file.buffer, req.file.mimetype);

    const { data, error } = await supabase.from('orders').insert({
      order_ref: orderRef,
      customer_name,
      customer_phone,
      customer_address,
      items_json: items,
      total: parseFloat(total),
      payment_screenshot: screenshotUrl,
      status: 'pending'
    }).select().single();

    if (error) throw error;

    sendOrderEmail(data);
    res.json({ success: true, order_ref: orderRef });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Something went wrong placing your order.' });
  }
});

// =========================================================
// ADMIN AUTH
// =========================================================

function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const { data: user, error } = await supabase.from('admin_users').select('*').eq('username', username).maybeSingle();
  if (error) return dbErr(res, error);
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

app.post('/api/admin/change-password', requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const { data: user, error } = await supabase.from('admin_users').select('*').eq('id', req.session.adminId).single();
  if (error) return dbErr(res, error);
  if (!bcrypt.compareSync(currentPassword || '', user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const password_hash = bcrypt.hashSync(newPassword, 10);
  const { error: updateErr } = await supabase.from('admin_users').update({ password_hash }).eq('id', user.id);
  if (updateErr) return dbErr(res, updateErr);
  res.json({ success: true });
});

// =========================================================
// ADMIN API \u2014 menu management
// =========================================================

const menuImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(jpg|jpeg|png|webp)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only JPG, PNG or WEBP images are allowed'), ok);
  }
});

app.get('/api/admin/menu', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('menu_items').select('*').order('sort_order', { ascending: true }).order('id', { ascending: true });
  if (error) return dbErr(res, error);
  res.json(data);
});

app.post('/api/admin/menu', requireAdmin, menuImageUpload.single('image'), async (req, res) => {
  try {
    const { name, description, price, category } = req.body;
    if (!name || !price || !category) return res.status(400).json({ error: 'Name, price and category are required.' });

    let image = req.body.existingImage || '';
    if (req.file) {
      const filename = `item-${Date.now()}${path.extname(req.file.originalname)}`;
      image = await uploadToBucket(MENU_BUCKET, filename, req.file.buffer, req.file.mimetype);
    }

    const { count } = await supabase.from('menu_items').select('*', { count: 'exact', head: true });
    const { data, error } = await supabase.from('menu_items').insert({
      name, description: description || '', price: parseFloat(price), category, image,
      is_available: true, sort_order: count || 0
    }).select().single();
    if (error) throw error;
    res.json({ success: true, id: data.id });
  } catch (err) {
    dbErr(res, err);
  }
});

app.put('/api/admin/menu/:id', requireAdmin, menuImageUpload.single('image'), async (req, res) => {
  try {
    const { data: existing, error: findErr } = await supabase.from('menu_items').select('*').eq('id', req.params.id).maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    let image = existing.image;
    if (req.file) {
      const filename = `item-${Date.now()}${path.extname(req.file.originalname)}`;
      image = await uploadToBucket(MENU_BUCKET, filename, req.file.buffer, req.file.mimetype);
    }

    const { name, description, price, category, is_available } = req.body;
    const { error } = await supabase.from('menu_items').update({
      name: name ?? existing.name,
      description: description ?? existing.description,
      price: price !== undefined ? parseFloat(price) : existing.price,
      category: category ?? existing.category,
      image,
      is_available: is_available !== undefined ? (is_available === 'true' || is_available === true || is_available === '1') : existing.is_available
    }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    dbErr(res, err);
  }
});

app.delete('/api/admin/menu/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase.from('menu_items').delete().eq('id', req.params.id);
  if (error) return dbErr(res, error);
  res.json({ success: true });
});

// =========================================================
// ADMIN API \u2014 orders
// =========================================================

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (error) return dbErr(res, error);
  res.json(data);
});

app.put('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'confirmed', 'fulfilled', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const { error } = await supabase.from('orders').update({ status }).eq('id', req.params.id);
  if (error) return dbErr(res, error);
  res.json({ success: true });
});

// =========================================================
// ADMIN API \u2014 settings (WhatsApp number, UPI id, bakery name)
// =========================================================

app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  const rows = Object.entries(req.body).map(([key, value]) => ({ key, value: String(value) }));
  const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
  if (error) return dbErr(res, error);
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
