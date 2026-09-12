// ---------- State ----------
let MENU = [];
let SETTINGS = {};
let CART = JSON.parse(localStorage.getItem('ibake_cart') || '{}'); // { itemId: qty }

function saveCart(){
  localStorage.setItem('ibake_cart', JSON.stringify(CART));
  renderCartCount();
}

function money(n){
  const symbol = (SETTINGS.currency_symbol) || '\u20b9';
  return symbol + Number(n).toLocaleString('en-IN');
}

// ---------- Load data ----------
async function loadData(){
  const [settingsRes, menuRes] = await Promise.all([
    fetch('/api/settings').then(r => r.json()),
    fetch('/api/menu').then(r => r.json())
  ]);
  SETTINGS = settingsRes;
  MENU = menuRes;

  const waNumber = SETTINGS.whatsapp_number || '919596459797';
  const customLink = document.getElementById('customCakeLink');
  if (customLink) {
    const msg = encodeURIComponent("Hi! I'd like to order a custom cake. Here are the details:\n- Theme:\n- Flavour:\n- Size:\n- Date needed:");
    customLink.href = `https://wa.me/${waNumber}?text=${msg}`;
  }

  renderCategoryTabs();
  renderMenu('all');
  renderCartCount();
}

// ---------- Category tabs ----------
function renderCategoryTabs(){
  const cats = ['all', ...new Set(MENU.map(i => i.category))];
  const wrap = document.getElementById('catTabs');
  wrap.innerHTML = cats.map(c =>
    `<button class="${c === 'all' ? 'active' : ''}" data-cat="${c}" onclick="selectCategory('${c}', this)">${c === 'all' ? 'All' : c}</button>`
  ).join('');
}

function selectCategory(cat, btn){
  document.querySelectorAll('#catTabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderMenu(cat);
}

// ---------- Menu rendering ----------
function renderMenu(filterCat){
  const section = document.getElementById('menuSection');
  const items = filterCat === 'all' ? MENU : MENU.filter(i => i.category === filterCat);

  if (items.length === 0) {
    section.innerHTML = `<p style="text-align:center; color:var(--ink-soft); padding:40px 0;">No items in this category yet.</p>`;
    return;
  }

  const byCategory = {};
  items.forEach(i => {
    if (!byCategory[i.category]) byCategory[i.category] = [];
    byCategory[i.category].push(i);
  });

  section.innerHTML = Object.entries(byCategory).map(([cat, catItems]) => `
    <h3 class="cat-heading">${cat}</h3>
    <div class="item-grid">
      ${catItems.map(renderItemCard).join('')}
    </div>
  `).join('');
}

function renderItemCard(item){
  const qty = CART[item.id] || 0;
  const imgSrc = item.image ? `/images/${item.image}` : 'https://placehold.co/400x300?text=iBake';
  return `
    <div class="item-card">
      <div class="thumb"><img src="${imgSrc}" alt="${item.name}" loading="lazy"></div>
      <div class="item-body">
        <h4>${item.name}</h4>
        <div class="desc">${item.description || ''}</div>
        <div class="item-footer">
          <div class="item-price">${money(item.price)}</div>
          <div id="ctrl-${item.id}">
            ${qty > 0 ? qtyControlHTML(item.id, qty) : `<button class="add-btn" onclick="addToCart(${item.id})">Add +</button>`}
          </div>
        </div>
      </div>
    </div>
  `;
}

function qtyControlHTML(id, qty){
  return `
    <div class="qty-control">
      <button onclick="changeQty(${id}, -1)">−</button>
      <span>${qty}</span>
      <button onclick="changeQty(${id}, 1)">+</button>
    </div>
  `;
}

function addToCart(id){
  CART[id] = 1;
  saveCart();
  document.getElementById('ctrl-' + id).innerHTML = qtyControlHTML(id, 1);
}

function changeQty(id, delta){
  CART[id] = (CART[id] || 0) + delta;
  if (CART[id] <= 0) delete CART[id];
  saveCart();
  const ctrl = document.getElementById('ctrl-' + id);
  if (ctrl) {
    ctrl.innerHTML = CART[id] ? qtyControlHTML(id, CART[id]) : `<button class="add-btn" onclick="addToCart(${id})">Add +</button>`;
  }
  renderCartDrawer();
}

function removeFromCart(id){
  delete CART[id];
  saveCart();
  const ctrl = document.getElementById('ctrl-' + id);
  if (ctrl) ctrl.innerHTML = `<button class="add-btn" onclick="addToCart(${id})">Add +</button>`;
  renderCartDrawer();
}

// ---------- Cart drawer ----------
function renderCartCount(){
  const total = Object.values(CART).reduce((a, b) => a + b, 0);
  const el = document.getElementById('cartCount');
  if (el) el.textContent = total;
}

function getCartLines(){
  return Object.entries(CART).map(([id, qty]) => {
    const item = MENU.find(m => m.id == id);
    return item ? { ...item, qty } : null;
  }).filter(Boolean);
}

function renderCartDrawer(){
  const lines = getCartLines();
  const itemsWrap = document.getElementById('cartItems');
  const footer = document.getElementById('cartFooter');

  if (lines.length === 0) {
    itemsWrap.innerHTML = `<div class="cart-empty">Your cart is empty.<br>Add something delicious!</div>`;
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'block';
  itemsWrap.innerHTML = lines.map(line => `
    <div class="cart-item">
      <img src="${line.image ? '/images/' + line.image : 'https://placehold.co/60x60'}" alt="${line.name}">
      <div class="info">
        <h5>${line.name}</h5>
        <div class="price">${money(line.price)} × ${line.qty} = ${money(line.price * line.qty)}</div>
        <button class="remove" onclick="removeFromCart(${line.id})">Remove</button>
      </div>
    </div>
  `).join('');

  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  document.getElementById('cartTotal').textContent = money(total);

  const waNumber = SETTINGS.whatsapp_number || '919596459797';
  const lineText = lines.map(l => `- ${l.name} x${l.qty} (${money(l.price * l.qty)})`).join('\n');
  const msg = encodeURIComponent(`Hi! I'd like to order:\n${lineText}\n\nTotal: ${money(total)}\n\nCould you confirm availability?`);
  document.getElementById('enquireBtn').onclick = () => window.open(`https://wa.me/${waNumber}?text=${msg}`, '_blank');
}

function openCart(){
  renderCartDrawer();
  document.getElementById('cartOverlay').classList.add('open');
  document.getElementById('cartDrawer').classList.add('open');
}
function closeCart(){
  document.getElementById('cartOverlay').classList.remove('open');
  document.getElementById('cartDrawer').classList.remove('open');
}

function goToCheckout(){
  if (Object.keys(CART).length === 0) return;
  window.location.href = '/checkout.html';
}

loadData();
