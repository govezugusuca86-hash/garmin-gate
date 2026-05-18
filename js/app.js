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
      id:    i.id,
      name:  i.name  || ('Товар #' + i.id),
      brand: i.brand || '',
      price: Number(i.price) || 0,
      qty:   Number(i.qty)   || 1
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

function savePendingOrder(payload) {
  const tmp = 'NEO-' + Date.now().toString(36).toUpperCase() + '-TMP';
  try {
    const raw = localStorage.getItem('gg_pending_orders');
    let list = [];
    if (raw) {
      try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) list = parsed; } catch (e) {}
    }
    list.push({ orderNumber: tmp, payload, savedAt: Date.now() });
    localStorage.setItem('gg_pending_orders', JSON.stringify(list));
  } catch (e) { /* localStorage может быть недоступен */ }
  return { orderNumber: tmp, isPending: true };
}

// URL Apps Script-вебхука (Google Sheets + Telegram)
window.ORDER_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzRewX8GWEw1MFB8PbkHSTcRri3h2odcywofwIzVyqZd_UDhjeCaJTP1PFTFq7Zu3DX/exec';

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

// ===== VK WIDGET =====
(function() {
  var style = document.createElement('style');
  style.textContent = '.vk-widget{position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:8px;}.vk-btn{width:56px;height:56px;background:#1a1a1a;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.3);transition:transform 0.2s,background 0.2s;text-decoration:none;}.vk-btn:hover{transform:scale(1.1);background:#c8a96e;}.vk-tooltip{background:#101010;color:#fff;font-size:13px;font-weight:700;padding:8px 14px;border-radius:8px;white-space:nowrap;opacity:0;transform:translateX(10px);transition:all 0.2s;pointer-events:none;}.vk-widget:hover .vk-tooltip{opacity:1;transform:translateX(0);}';
  document.head.appendChild(style);

  var widget = document.createElement('div');
  widget.className = 'vk-widget';
  widget.innerHTML = '<div class="vk-tooltip">Написать в VK</div><a href="https://vk.me/neogar_shop" target="_blank" class="vk-btn"><svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M15.07 2H8.93C3.33 2 2 3.33 2 8.93v6.14C2 20.67 3.33 22 8.93 22h6.14C20.67 22 22 20.67 22 15.07V8.93C22 3.33 20.67 2 15.07 2zm2.18 13.17h-1.49c-.56 0-.73-.44-1.74-1.46-.87-.85-1.26-.97-1.47-.97-.3 0-.38.08-.38.49v1.33c0 .35-.11.56-1.03.56-1.52 0-3.2-.92-4.38-2.64C5.1 10.35 4.7 8.74 4.7 8.38c0-.21.08-.4.49-.4h1.49c.37 0 .5.17.64.56.71 2.03 1.89 3.81 2.38 3.81.18 0 .26-.08.26-.54V9.63c-.06-1-.57-1.08-.57-1.44 0-.17.14-.35.37-.35h2.35c.31 0 .42.17.42.53v2.89c0 .31.14.42.22.42.18 0 .34-.11.68-.45 1.05-1.18 1.8-2.99 1.8-2.99.1-.21.27-.4.64-.4h1.49c.45 0 .55.23.45.54-.19.87-2.02 3.46-2.02 3.46-.16.26-.22.38 0 .67.16.21.69.67 1.04 1.08.65.74 1.14 1.36 1.27 1.79.12.42-.09.64-.51.64z"/></svg></a>';

  document.addEventListener('DOMContentLoaded', function() {
    document.body.appendChild(widget);
  });
})();

// ===== ЯНДЕКС МЕТРИКА =====
// Подключается в <head> каждой HTML-страницы (счётчик 108563480).
// Дополнительно инициализировать здесь не нужно.
