# iBake — Menu & Ordering Website

A full ordering website for iBake with:
- Customer-facing menu with cart (no account needed)
- "Make a Custom Cake" button that opens WhatsApp directly
- Checkout with UPI QR code + payment screenshot upload
- Admin dashboard (password-protected) to manage menu items and view orders
- Optional email alert on every new order

Built with Node.js + Express + SQLite (a real database file, no external service needed).

---

## 1. First-time setup

```bash
npm install
cp .env.example .env
```

Open `.env` and fill in:
- `SESSION_SECRET` — any long random string
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — your admin login (only used the very first time the database is created)
- `SMTP_USER` / `SMTP_PASS` / `NOTIFY_EMAIL` — leave blank to skip email alerts, or see step 4 below to enable them

Then seed the menu with the starting cake photos and **placeholder prices (₹999 each — edit these in the admin dashboard)**:

```bash
npm run seed
```

Start the app:

```bash
npm start
```

Visit:
- **Customer site:** http://localhost:3000
- **Admin dashboard:** http://localhost:3000/admin

---

## 2. Default admin login

- **Username:** whatever you set as `ADMIN_USERNAME` in `.env` (default `admin`)
- **Password:** whatever you set as `ADMIN_PASSWORD` in `.env` (default `ibake2026`)

**Change this password immediately** from Admin → Settings → Change Password once you're live. The `.env` values only apply the very first time the database is created — after that, the password lives in the database and `.env` no longer matters for login.

---

## 3. Editing the menu, prices and WhatsApp number

Everything is editable from `/admin` without touching code:
- **Menu Items tab** — add, edit, delete cakes, upload photos, set prices, toggle availability
- **Orders tab** — see every order with customer name/phone/address, the payment screenshot, and a status dropdown (pending → confirmed → fulfilled)
- **Settings tab** — change the bakery name, WhatsApp number, and UPI ID shown on checkout

The current menu items use placeholder ₹999 prices and stock photos from the client's Instagram — replace both with the real thing whenever ready.

---

## 4. Turning on email order alerts (optional)

1. On the Gmail account that should send alerts, turn on 2-Step Verification: https://myaccount.google.com/security
2. Create an App Password: https://myaccount.google.com/apppasswords
3. In `.env`, set:
   ```
   SMTP_USER=youraccount@gmail.com
   SMTP_PASS=the 16-character app password (no spaces)
   NOTIFY_EMAIL=whichever address should receive alerts
   ```
4. Restart the app. Every new order will now email that address automatically, in addition to always showing up in the Orders tab.

---

## 5. Deploying so it's live on the internet

This app needs a host that runs Node.js — it can't go on free static hosting like Netlify. **Render.com** has a free tier that works well for this:

1. Push this project to a GitHub repository (private is fine).
2. On [render.com](https://render.com), click **New → Web Service**, connect your GitHub repo.
3. Settings:
   - **Build Command:** `npm install && npm run seed`
   - **Start Command:** `npm start`
4. Under **Environment**, add the same variables from your `.env` file (SESSION_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD, SMTP_USER, SMTP_PASS, NOTIFY_EMAIL).
5. Deploy. Render gives you a live URL — you can point a custom domain at it later from Render's settings.

**One caveat with Render's free tier:** the filesystem resets on redeploy, which means the SQLite database (menu items, orders, uploaded screenshots) would reset too. For a real launch handling real orders, upgrade to Render's small paid tier with a persistent disk (a few dollars a month) — this keeps the database and uploaded screenshots safe across deploys. Happy to help set that up when you're ready to go live for real.

---

## 6. Project structure

```
ibake-app/
├── server.js          # Express server + all API routes
├── db.js              # Database schema + connection
├── seed.js            # One-time menu seeding script
├── public/
│   ├── index.html     # Customer menu page
│   ├── checkout.html  # Cart checkout + payment upload
│   ├── css/styles.css # Shared theme
│   ├── js/app.js      # Menu + cart logic
│   ├── js/admin.js    # Admin dashboard logic
│   ├── images/        # Menu item photos + QR code
│   └── uploads/       # Customer payment screenshots (auto-created)
└── views/
    ├── admin-login.html
    └── admin-dashboard.html
```
