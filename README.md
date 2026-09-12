# iBake — Menu & Ordering Website (v2, Supabase-backed)

A full ordering website for iBake:
- Customer-facing menu with cart (no account needed)
- "Make a Custom Cake" button that opens WhatsApp directly
- Checkout with UPI QR code + payment screenshot upload
- Admin dashboard (password-protected) to manage menu items and view orders
- Optional email alert on every new order

**Why v2 exists:** the first version stored data in a local SQLite file. On free
hosting (Render's free tier), the server restarts after ~20-30 min of no traffic,
which wipes anything written to local disk — so newly added menu items and
orders were disappearing. This version moves the database and all uploaded
images to **Supabase** (free Postgres database + free file storage), so nothing
lives on the hosting server's disk anymore. The app itself can restart freely
without losing anything.

---

## 1. Set up Supabase (one-time, ~10 minutes)

1. Go to [supabase.com](https://supabase.com) and create a free account + new project (no credit card required). Pick any region close to your customers.
2. Once the project is created, go to **SQL Editor** (left sidebar) → **New query**, paste in the entire contents of `supabase-schema.sql` (included in this project), and click **Run**. This creates the four tables the app needs.
3. Go to **Storage** (left sidebar) and create two buckets:
   - `menu-images` — set it to **Public**
   - `payment-screenshots` — set it to **Public**
   (Public just means anyone with the exact file URL can view that one file — it does not expose your database or let anyone list/browse the bucket.)
4. Go to **Settings → API**. You'll need two values from this page:
   - **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
   - **service_role key** (under "Project API keys" — click reveal. This is a secret key, treat it like a password. Do NOT use the "anon public" key for this app.)

---

## 2. Local setup

```bash
npm install
cp .env.example .env
```

Open `.env` and fill in:
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — from step 1.4 above
- `SESSION_SECRET` — any long random string
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — your admin login (only used the first time you run the seed script)

Then seed the menu, admin account, and default settings:

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

## 3. Default admin login

- **Username / Password:** whatever you set in `.env` before running `npm run seed`.

**Change this password immediately** from Admin → Settings → Change Password once you're live. After the first seed, the password lives in Supabase — editing `.env` afterwards won't change it.

---

## 4. Editing the menu, prices and WhatsApp number

Everything is editable from `/admin` without touching code:
- **Menu Items tab** — add, edit, delete cakes, upload photos, set prices, toggle availability. New photos you upload here go straight to Supabase Storage, so they persist properly.
- **Orders tab** — every order with customer name/phone/address, the payment screenshot, and a status dropdown (pending → confirmed → fulfilled).
- **Settings tab** — bakery name, WhatsApp number, UPI ID shown at checkout.

The seeded menu items use placeholder ₹999 prices and stock photos pulled from Instagram — replace both with the real thing whenever ready.

**One thing that's still manual:** the QR code image on the checkout page (`public/images/qr.png`) is a static file, generated once from a placeholder UPI ID. If you change the UPI ID in Settings, regenerate that QR image to match (any free UPI QR generator works, or ask me to add one that generates automatically from whatever UPI ID is saved in Settings).

---

## 5. Turning on email order alerts (optional)

1. On the Gmail account that should send alerts, turn on 2-Step Verification: https://myaccount.google.com/security
2. Create an App Password: https://myaccount.google.com/apppasswords
3. In `.env`:
   ```
   SMTP_USER=youraccount@gmail.com
   SMTP_PASS=the 16-character app password (no spaces)
   NOTIFY_EMAIL=whichever address should receive alerts
   ```
4. Restart the app. Every new order now emails that address, in addition to always showing up in the Orders tab.

---

## 6. Deploying to Render (free)

1. Push this project to a GitHub repository (private is fine).
2. On [render.com](https://render.com), **New → Web Service**, connect your repo.
3. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - *(You do NOT need to run the seed command on Render — run `npm run seed` once from your own computer, pointed at the same Supabase project, before or after deploying. Seeding twice is safe; it skips anything already there.)*
4. Under **Environment**, add every variable from your `.env` file: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, and the email ones if you're using them.
5. Deploy. Render gives you a live URL — share that link directly with customers.

**What's fixed vs. before:** Render's free tier still spins the server down after idle time, and the first visitor after a quiet period will wait ~30-50 seconds for it to wake up — that part of "free hosting" doesn't go away. But now that spin-down/restart cycle no longer touches your data — menu items, orders and uploaded images all live in Supabase, untouched by Render restarting.

---

## 7. Project structure

```
ibake-app/
├── server.js              # Express server + all API routes (talks to Supabase)
├── db.js                  # Supabase client setup + storage upload helper
├── seed.js                # One-time menu/admin/settings seeding script
├── supabase-schema.sql    # Run once in Supabase's SQL Editor
├── public/
│   ├── index.html         # Customer menu page
│   ├── checkout.html      # Cart checkout + payment upload
│   ├── css/styles.css     # Shared theme
│   ├── js/app.js          # Menu + cart logic
│   ├── js/admin.js        # Admin dashboard logic
│   └── images/            # Seeded cake photos + QR code (shipped with the code)
└── views/
    ├── admin-login.html
    └── admin-dashboard.html
```
