// ===== CART =====
const Cart = {
  get() { return JSON.parse(localStorage.getItem('gg_cart') || '[]'); },
  save(cart) {
    localStorage.setItem('gg_cart', JSON.stringify(cart));
    if (typeof window.updateCartBadge === 'function') window.updateCartBadge();
  },
  add(product) {
    const cart = Cart.get();
    const idx = cart.findIndex(i => i.id === product.id);
    if (idx >= 0) cart[idx].qty++;
    else cart.push({ ...product, qty: 1 });
    Cart.save(cart);
    showToast('Добавлено в корзину ✓', 'success');
  },
  remove(id) {
    Cart.save(Cart.get().filter(i => i.id !== id));
  },
  updateQty(id, qty) {
    const cart = Cart.get();
    const idx = cart.findIndex(i => i.id === id);
    if (idx >= 0) { cart[idx].qty = Math.max(1, qty); Cart.save(cart); }
  },
  clear() { Cart.save([]); },
  total() { return Cart.get().reduce((s, i) => s + i.price * i.qty, 0); },
  count() { return Cart.get().reduce((s, i) => s + i.qty, 0); },

  // ===== ОФОРМЛЕНИЕ ЗАКАЗА =====
  getOrderSummary() {
    const items = Cart.get().map(i => ({
      id:      i.id,
      name:    i.name  || ('Товар #' + i.id),
      brand:   i.brand || '',
      price:   Number(i.price) || 0,
      qty:     Number(i.qty)   || 1,
      picture: i.picture || ''
    }));
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    return { items, total };
  },

  // Отправляет заказ на Apps Script. При ошибке — сохраняет локально и
  // возвращает временный номер с isPending:true.
  submitOrder(payload) {
    const url = window.ORDER_WEBHOOK_URL;
    if (!url || url.indexOf('REPLACE_ME') !== -1) {
      console.warn('[Cart.submitOrder] ORDER_WEBHOOK_URL не настроен — fallback');
      return Promise.resolve(savePendingOrder(payload));
    }
    return fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // no CORS preflight
      body: JSON.stringify(payload),
      redirect: 'follow'
    }).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(data => {
      if (!data || data.ok !== true || !data.orderNumber) {
        throw new Error('Bad response: ' + JSON.stringify(data));
      }
      return { orderNumber: data.orderNumber, isPending: false, duplicate: !!data.duplicate };
    }).catch(err => {
      console.warn('[Cart.submitOrder] fallback:', err);
      return savePendingOrder(payload);
    });
  }
};

function nextLocalNumber() {
  // Локальный fallback-счётчик: используется только если Apps Script недоступен.
  // Стартует с 986, чтобы первый выданный номер был NEO-0987.
  // Серверная нумерация настраивается в Apps Script: в Project Settings →
  // Script Properties добавить lastOrderNumber = 986 (тогда первый серверный
  // заказ тоже будет NEO-0987).
  let n = 0;
  try { n = parseInt(localStorage.getItem('gg_order_counter') || '986', 10) || 986; } catch (e) {}
  n += 1;
  try { localStorage.setItem('gg_order_counter', String(n)); } catch (e) {}
  return 'NEO-' + String(n).padStart(4, '0');
}

function savePendingOrder(payload) {
  const num = nextLocalNumber();
  try {
    const raw = localStorage.getItem('gg_pending_orders');
    let list = [];
    if (raw) {
      try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) list = parsed; } catch (e) {}
    }
    list.push({ orderNumber: num, payload, savedAt: Date.now() });
    localStorage.setItem('gg_pending_orders', JSON.stringify(list));
  } catch (e) { /* localStorage может быть недоступен */ }
  return { orderNumber: num, isPending: true };
}

// URL Apps Script-вебхука (Google Sheets + Telegram)
window.ORDER_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycby7f87S07emIBHY2XdVTPavoA8t8NCcKaE__ue5zd3NB16IdBa85sPGWn5Ke8YXKSBL/exec';

// ===== FAVORITES =====
const Favs = {
  get() { return JSON.parse(localStorage.getItem('gg_favs') || '[]'); },
  toggle(id) {
    let favs = Favs.get();
    if (favs.includes(id)) favs = favs.filter(f => f !== id);
    else favs.push(id);
    localStorage.setItem('gg_favs', JSON.stringify(favs));
    return favs.includes(id);
  },
  has(id) { return Favs.get().includes(id); }
};

// ===== TOAST =====
function showToast(msg, type = '') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'toast ' + type;
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== PRICE FORMAT =====
function formatPrice(p) {
  return p.toLocaleString('ru-RU') + ' ₽';
}

// ===== PRODUCT CARD =====
function renderCard(p) {
  const hasDiscount = p.oldprice && p.oldprice > p.price;
  const discount = hasDiscount ? Math.round((1 - p.price / p.oldprice) * 100) : 0;
  const inCart = Cart.get().find(i => i.id === p.id);
  const isFav = Favs.has(p.id);
  return `
    <div class="product-card" data-id="${p.id}">
      <div class="product-badge">
        ${hasDiscount ? `<span class="badge badge-sale">-${discount}%</span>` : ''}
      </div>
      <div class="product-fav ${isFav ? 'active' : ''}" onclick="toggleFav('${p.id}', this)" title="В избранное">
        <svg width="18" height="18" viewBox="0 0 20 19" fill="${isFav ? '#c8a96e' : 'none'}" stroke="${isFav ? '#c8a96e' : '#d1d1d1'}" stroke-width="2">
          <path d="M9.33 2.8L10 3.41l.67-.61C12.6 1.05 15.58 1.11 17.43 2.99c1.93 1.95 1.93 5.12 0 7.07L10.69 16.89c-.38.38-.99.38-1.37 0L2.56 10.06C.64 8.11.64 4.94 2.56 2.99 4.42 1.11 7.39 1.05 9.33 2.8z"/>
        </svg>
      </div>
      <div class="product-img">
        <a href="pages/product.html?id=${p.id}">
          <img src="${p.picture}" alt="${p.name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22><rect fill=%22%23f0f0f0%22 width=%22160%22 height=%22160%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2214%22>Нет фото</text></svg>'">
        </a>
      </div>
      <div class="product-brand">${p.brand}</div>
      <div class="product-name"><a href="pages/product.html?id=${p.id}">${p.name}</a></div>
      <div class="product-price">
        <span class="price-current ${hasDiscount ? 'discounted' : ''}">${formatPrice(p.price)}</span>
        ${hasDiscount ? `<span class="price-old">${formatPrice(p.oldprice)}</span>` : ''}
      </div>
      <button class="btn-cart ${inCart ? 'in-cart' : ''}" onclick="addToCart(event, '${p.id}')">
        ${inCart ? 'В корзине ✓' : 'В корзину'}
      </button>
    </div>`;
}

function addToCart(e, id) {
  e.preventDefault();
  const p = findProduct(id);
  if (!p) return;
  Cart.add(p);
  const btn = e.target;
  btn.classList.add('in-cart');
  btn.textContent = 'В корзине ✓';
}

function toggleFav(id, el) {
  const active = Favs.toggle(id);
  el.classList.toggle('active', active);
  el.querySelector('svg').setAttribute('fill', active ? '#c8a96e' : 'none');
  el.querySelector('svg').setAttribute('stroke', active ? '#c8a96e' : '#d1d1d1');
}

function findProduct(id) {
  return PRODUCTS_DATA.products.find(p => p.id === id);
}

// ===== HEADER / FOOTER =====
// Шапка, подвал, hamburger и cart-badge обрабатываются в js/site.js
// через автомонтирование по <div data-mount="header"></div> / <div data-mount="footer"></div>.

// ===== MESSENGER WIDGETS (Telegram + MAX) =====
(function() {
  var style = document.createElement('style');
  style.textContent = '.msg-widgets{position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:12px;}.msg-widget{display:flex;align-items:center;gap:8px;flex-direction:row-reverse;}.msg-btn{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.25);transition:transform 0.2s,box-shadow 0.2s;text-decoration:none;flex-shrink:0;}.msg-btn:hover{transform:scale(1.1);box-shadow:0 6px 24px rgba(0,0,0,0.35);}.msg-tooltip{background:#101010;color:#fff;font-size:12px;font-weight:700;padding:6px 12px;border-radius:6px;white-space:nowrap;opacity:0;transform:translateX(8px);transition:all 0.2s;pointer-events:none;}.msg-widget:hover .msg-tooltip{opacity:1;transform:translateX(0);}';
  document.head.appendChild(style);

  var container = document.createElement('div');
  container.className = 'msg-widgets';
  container.innerHTML =
    '<div class="msg-widget">' +
      '<span class="msg-tooltip">MAX</span>' +
      '<a href="https://max.ru/u/f9LHodD0cOIZPc3t_P6gS2FugFx-px34uz96F0jFOJwjbQQmKSYSSKLSn98" target="_blank" rel="noopener" class="msg-btn" style="background:#1a1a1a;">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
      '</a>' +
    '</div>' +
    '<div class="msg-widget">' +
      '<span class="msg-tooltip">Telegram</span>' +
      '<a href="https://t.me/Egor_neogar" target="_blank" rel="noopener" class="msg-btn" style="background:#29b6f6;">' +
        '<svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>' +
      '</a>' +
    '</div>';

  document.addEventListener('DOMContentLoaded', function() {
    document.body.appendChild(container);
  });
})();

// ===== ЯНДЕКС МЕТРИКА =====
// Подключается в <head> каждой HTML-страницы (счётчик 108563480).
// Дополнительно инициализировать здесь не нужно.
