// Seeds the menu with placeholder items + placeholder prices.
// Run once with: npm run seed
// Client can edit everything (name, price, description, image, availability) from /admin afterwards.

const db = require('./db');

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

const insert = db.prepare(`
  INSERT INTO menu_items (name, description, price, category, image, is_available, sort_order)
  VALUES (@name, @description, @price, @category, @image, 1, @sort_order)
`);

const existing = db.prepare('SELECT COUNT(*) as c FROM menu_items').get().c;
if (existing > 0) {
  console.log('[seed] menu_items already has data \u2014 skipping seed to avoid duplicates.');
  console.log('[seed] Delete ibake.db and re-run "npm run seed" if you want to reseed from scratch.');
  process.exit(0);
}

const insertMany = db.transaction((rows) => {
  rows.forEach((row, i) => insert.run({ ...row, price: 999, sort_order: i }));
});

insertMany(items);
console.log(`[seed] Inserted ${items.length} placeholder menu items with price \u20b9999 (edit real prices in /admin).`);
