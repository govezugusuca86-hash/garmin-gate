// ===== CART =====
const Cart = {
  get() { return JSON.parse(localStorage.getItem('gg_cart') || '[]'); },
  save(cart) { localStorage.setItem('gg_cart', JSON.stringify(cart)); Cart.updateBadge(); },
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
  updateBadge() {
    const cnt = Cart.count();
    document.querySelectorAll('.cart-badge').forEach(el => {
      el.textContent = cnt;
      el.style.display = cnt > 0 ? 'flex' : 'none';
    });
  }
};

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
        <svg width="18" height="18" viewBox="0 0 20 19" fill="${isFav ? '#2f5ed7' : 'none'}" stroke="${isFav ? '#2f5ed7' : '#d1d1d1'}" stroke-width="2">
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
  el.querySelector('svg').setAttribute('fill', active ? '#2f5ed7' : 'none');
  el.querySelector('svg').setAttribute('stroke', active ? '#2f5ed7' : '#d1d1d1');
}

function findProduct(id) {
  return PRODUCTS_DATA.products.find(p => p.id === id);
}

// ===== HEADER INIT =====
function initHeader() {
  Cart.updateBadge();

  // Hamburger
  const hamb = document.querySelector('.hamburger');
  const mobMenu = document.querySelector('.mobile-menu');
  if (hamb && mobMenu) {
    hamb.addEventListener('click', () => mobMenu.classList.toggle('open'));
  }
}

// ===== INIT on page load =====
document.addEventListener('DOMContentLoaded', initHeader);
