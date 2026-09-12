// Seeds Supabase with placeholder menu items, a default admin user, and default settings.
// Run once with: npm run seed
// Safe to re-run \u2014 it skips seeding anything that already has rows.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { supabase } = require('./db');

const items = [
  { name: 'Storybook Teacher\u2019s Day Cake', category: 'Theme Cakes', description: 'Fondant book-and-quill design, customizable message.', image: 'teacher-cake.jpg' },
  { name: 'Floral Petal Sheet Cake', category: 'Theme Cakes', description: 'Buttercream sheet cake with hand-piped petals, great for events.', image: 'teachers-day-sheet.jpg' },
  { name: 'Royal Drape Mehendi Cake', category: 'Wedding & Occasion', description: 'Fondant drape design in festive colours, fully customizable text.', image: 'mehendi-drape-cake.jpg' },
  { name: '\u201cSoon To Be Mrs\u201d Bridal Cake', category: 'Wedding & Occasion', description: 'Elegant bow and heart detailing, perfect for bridal showers.', image: 'soon-to-be-mrs.jpg' },
  { name: 'Pistachio Nikkah Cake', category: 'Wedding & Occasion', description: 'Crushed pistachio top with elegant white chocolate fan border.', image: 'nikkah-pistachio.jpg' },
  { name: 'Fresh Fruit Wedding Cake', category: 'Wedding & Occasion', description: 'Whipped cream base topped with seasonal fresh fruit.', image: 'fruit-cake-wedding.jpg' },
  { name: 'Custom Illustrated Theme Cake', category: 'Theme Cakes', description: 'Fully custom fondant illustration \u2014 tell us your theme.', image: 'piano-theme-cake.jpg' },
  { name: 'Rose Tiered Celebration Cake', category: 'Wedding & Occasion', description: 'Two-tier buttercream cake with fresh rose detailing.', image: 'rose-tier-nikkah.jpg' },
  { name: 'First Birthday Theme Cake', category: 'Birthday', description: 'Custom fondant topper set, ask us about your theme.', image: 'first-birthday-minahil.jpg' },
  { name: 'Royal Enfield Theme Cake', category: 'Birthday', description: 'Hand-sculpted fondant bike topper on a rich base cake.', image: 'royal-enfield-cake.jpg' },
  { name: 'Red Velvet Rose Tier Cake', category: 'Birthday', description: 'Semi-naked red velvet finish with fresh rose accents.', image: 'red-velvet-tier.jpg' },
  { name: 'Rainbow Character Birthday Cake', category: 'Birthday', description: 'Playful fondant character toppers with rainbow arch.', image: 'rainbow-birthday.jpg' },
];

async function seedMenu() {
  const { count, error: countErr } = await supabase.from('menu_items').select('*', { count: 'exact', head: true });
  if (countErr) throw countErr;
  if (count > 0) {
    console.log('[seed] menu_items already has data \u2014 skipping to avoid duplicates.');
    return;
  }
  const rows = items.map((item, i) => ({ ...item, price: 999, sort_order: i, is_available: true }));
  const { error } = await supabase.from('menu_items').insert(rows);
  if (error) throw error;
  console.log(`[seed] Inserted ${items.length} placeholder menu items with price \u20b9999 (edit real prices in /admin).`);
}

async function seedAdmin() {
  const { count, error: countErr } = await supabase.from('admin_users').select('*', { count: 'exact', head: true });
  if (countErr) throw countErr;
  if (count > 0) {
    console.log('[seed] admin_users already has an account \u2014 skipping.');
    return;
  }
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'ibake2026';
  const password_hash = bcrypt.hashSync(password, 10);
  const { error } = await supabase.from('admin_users').insert({ username, password_hash });
  if (error) throw error;
  console.log(`[seed] Created default admin user "${username}" \u2014 change the password after first login.`);
}

async function seedSettings() {
  const { count, error: countErr } = await supabase.from('settings').select('*', { count: 'exact', head: true });
  if (countErr) throw countErr;
  if (count > 0) {
    console.log('[seed] settings already populated \u2014 skipping.');
    return;
  }
  const defaults = [
    { key: 'bakery_name', value: 'iBake' },
    { key: 'whatsapp_number', value: '919596459797' },
    { key: 'upi_id', value: 'ibake@upi' },
    { key: 'currency_symbol', value: '\u20b9' }
  ];
  const { error } = await supabase.from('settings').insert(defaults);
  if (error) throw error;
  console.log('[seed] Inserted default settings.');
}

(async () => {
  try {
    await seedAdmin();
    await seedSettings();
    await seedMenu();
    console.log('\n[seed] Done.');
    process.exit(0);
  } catch (err) {
    console.error('[seed] Failed:', err.message);
    process.exit(1);
  }
})();
