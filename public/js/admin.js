function imageUrl(image){
  if (!image) return 'https://placehold.co/44x44';
  return image.startsWith('http') ? image : `/images/${image}`;
}

// ---------- Auth guard ----------
async function checkAuth(){
  const res = await fetch('/api/admin/me');
  const data = await res.json();
  if (!data.loggedIn) window.location.href = '/admin';
}
checkAuth();

function logout(){
  fetch('/api/admin/logout', { method: 'POST' }).then(() => window.location.href = '/admin');
}

// ---------- Tabs ----------
function switchTab(tab, btn){
  document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  if (tab === 'orders') loadOrders();
  if (tab === 'menu') loadMenu();
  if (tab === 'settings') loadSettings();
}

// ---------- Orders ----------
async function loadOrders(){
  const orders = await fetch('/api/admin/orders').then(r => r.json());
  const tbody = document.getElementById('ordersBody');
  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--ink-soft);">No orders yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = orders.map(o => {
    const items = JSON.parse(o.items_json);
    const itemsText = items.map(i => `${i.name} x${i.qty}`).join(', ');
    return `
      <tr>
        <td><b>${o.order_ref}</b></td>
        <td>${o.customer_name}<br><span style="color:var(--ink-soft);">${o.customer_phone}</span><br><span style="color:var(--ink-soft); font-size:11.5px;">${o.customer_address}</span></td>
        <td>${itemsText}</td>
        <td>₹${o.total}</td>
        <td>${o.payment_screenshot ? `<a href="${o.payment_screenshot}" target="_blank"><img class="thumb-sm" src="${o.payment_screenshot}"></a>` : '—'}</td>
        <td>
          <select class="status-select" onchange="updateStatus(${o.id}, this.value)">
            ${['pending','confirmed','fulfilled','cancelled'].map(s => `<option value="${s}" ${s===o.status?'selected':''}>${s}</option>`).join('')}
          </select>
        </td>
        <td style="font-size:11.5px; color:var(--ink-soft);">${new Date(o.created_at).toLocaleString()}</td>
      </tr>
    `;
  }).join('');
}

async function updateStatus(id, status){
  await fetch(`/api/admin/orders/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
}

// ---------- Menu ----------
let MENU_CACHE = [];

async function loadMenu(){
  MENU_CACHE = await fetch('/api/admin/menu').then(r => r.json());
  const tbody = document.getElementById('menuBody');
  if (MENU_CACHE.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--ink-soft);">No menu items yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = MENU_CACHE.map(item => `
    <tr>
      <td><img class="thumb-sm" src="${imageUrl(item.image)}"></td>
      <td><b>${item.name}</b><br><span style="color:var(--ink-soft); font-size:11.5px;">${item.description || ''}</span></td>
      <td>${item.category}</td>
      <td>₹${item.price}</td>
      <td>${item.is_available ? '✅' : '❌'}</td>
      <td>
        <button class="icon-btn edit" onclick="openItemModal(${item.id})">Edit</button>
        <button class="icon-btn" onclick="deleteItem(${item.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

function openItemModal(id){
  document.getElementById('itemModal').classList.add('open');
  const form = document.getElementById('itemForm');
  form.reset();
  document.getElementById('itemId').value = '';
  document.getElementById('modalTitle').textContent = 'Add Item';

  if (id) {
    const item = MENU_CACHE.find(m => m.id === id);
    document.getElementById('modalTitle').textContent = 'Edit Item';
    document.getElementById('itemId').value = item.id;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemDesc').value = item.description || '';
    document.getElementById('itemPrice').value = item.price;
    document.getElementById('itemCategory').value = item.category;
    document.getElementById('itemAvailable').checked = !!item.is_available;
  }
}
function closeItemModal(){
  document.getElementById('itemModal').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('itemForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('itemId').value;
    const fd = new FormData();
    fd.append('name', document.getElementById('itemName').value);
    fd.append('description', document.getElementById('itemDesc').value);
    fd.append('price', document.getElementById('itemPrice').value);
    fd.append('category', document.getElementById('itemCategory').value);
    fd.append('is_available', document.getElementById('itemAvailable').checked);
    const fileInput = document.getElementById('itemImage');
    if (fileInput.files[0]) fd.append('image', fileInput.files[0]);

    const url = id ? `/api/admin/menu/${id}` : '/api/admin/menu';
    const method = id ? 'PUT' : 'POST';
    await fetch(url, { method, body: fd });
    closeItemModal();
    loadMenu();
  });
});

async function deleteItem(id){
  if (!confirm('Delete this menu item?')) return;
  await fetch(`/api/admin/menu/${id}`, { method: 'DELETE' });
  loadMenu();
}

// ---------- Settings ----------
async function loadSettings(){
  const settings = await fetch('/api/settings').then(r => r.json());
  document.getElementById('set_bakery_name').value = settings.bakery_name || '';
  document.getElementById('set_whatsapp_number').value = settings.whatsapp_number || '';
  document.getElementById('set_upi_id').value = settings.upi_id || '';
}

async function saveSettings(){
  await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bakery_name: document.getElementById('set_bakery_name').value,
      whatsapp_number: document.getElementById('set_whatsapp_number').value,
      upi_id: document.getElementById('set_upi_id').value
    })
  });
  const saved = document.getElementById('settingsSaved');
  saved.style.display = 'block';
  setTimeout(() => saved.style.display = 'none', 2000);
}

async function changePassword(){
  const msg = document.getElementById('passMsg');
  msg.style.display = 'none';
  const res = await fetch('/api/admin/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentPassword: document.getElementById('curPass').value,
      newPassword: document.getElementById('newPass').value
    })
  });
  const data = await res.json();
  if (res.ok) {
    msg.style.color = '#237a3c';
    msg.textContent = 'Password updated!';
    msg.style.display = 'block';
    document.getElementById('curPass').value = '';
    document.getElementById('newPass').value = '';
  } else {
    msg.style.color = '#b3261e';
    msg.textContent = data.error;
    msg.style.display = 'block';
  }
}

// ---------- Init ----------
loadOrders();
