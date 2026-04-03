// ===== VELGAR — Общие данные сайта =====
const SITE = {
  name: 'Velgar',
  tagline: 'Официальный магазин спортивной электроники',
  domain: 'velgar.ru',
  url: 'https://velgar.ru',
  phone: '+7 (000) 000-00-00',
  email: 'info@velgar.ru',
  address: 'г. Орёл, Карачевское ш., 74',
  vk: 'https://vk.com/velgar_shop',
  legal: 'ИП Гончаров Сергей Игоревич',
  inn: '575311048066',
  ogrnip: '322574900020653',
  vkChat: 'https://vk.me/velgar_shop',
};

// ===== ШАПКА =====
function renderHeader(activePage) {
  return `
<header class="header">
  <div class="header-top">
    🚚 Доставка по всей России — СДЭК, Яндекс Доставка, Почта России &nbsp;|&nbsp;
    <a href="${SITE.vk}" target="_blank" style="color:#fff;text-decoration:underline;">ВКонтакте</a>
  </div>
  <div class="container">
    <div class="header-main">
      <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
      <a href="${activePage === 'index' ? 'index.html' : '../index.html'}" class="header-logo">Vel<span>gar</span></a>
      <nav class="header-nav">
        <a href="${activePage === 'index' ? 'index.html' : '../index.html'}" ${activePage==='index'?'class="active"':''}>Каталог</a>
        <a href="${activePage === 'index' ? 'index.html?cat=1' : '../index.html?cat=1'}">Часы</a>
        <a href="${activePage === 'index' ? 'index.html?cat=4' : '../index.html?cat=4'}">Велокомпьютеры</a>
        <a href="${activePage === 'index' ? 'index.html?cat=9' : '../index.html?cat=9'}">Навигаторы</a>
        <a href="${activePage === 'index' ? 'pages/about.html' : 'about.html'}">О магазине</a>
        <a href="${activePage === 'index' ? 'index.html?sale=1' : '../index.html?sale=1'}" style="color:#f02424;">Распродажа</a>
      </nav>
      <div class="header-actions">
        <a href="${activePage === 'index' ? 'pages/cart.html' : 'cart.html'}" class="btn-icon" title="Корзина">
          <svg width="22" height="22" viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 15C5 13.9 5.9 13 7 13h20c1.1 0 2 .9 2 2v13c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V15z"/><path d="M23 12V8c0-1.7-1.3-3-3-3h-6C12.3 5 11 6.3 11 8v4"/></svg>
          <span class="badge cart-badge" style="display:none">0</span>
        </a>
        <a href="${activePage === 'index' ? 'pages/favorites.html' : 'favorites.html'}" class="btn-icon" title="Избранное">
          <svg width="22" height="22" viewBox="0 0 20 19" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.33 2.8L10 3.41l.67-.61C12.6 1.05 15.58 1.11 17.43 2.99c1.93 1.95 1.93 5.12 0 7.07L10.69 16.89c-.38.38-.99.38-1.37 0L2.56 10.06C.64 8.11.64 4.94 2.56 2.99 4.42 1.11 7.39 1.05 9.33 2.8z"/></svg>
        </a>
      </div>
    </div>
  </div>
  <nav class="mobile-menu" id="mobileMenu">
    <a href="${activePage === 'index' ? 'index.html' : '../index.html'}">🏠 Главная</a>
    <a href="${activePage === 'index' ? 'index.html?cat=1' : '../index.html?cat=1'}">⌚ Спортивные часы</a>
    <a href="${activePage === 'index' ? 'index.html?cat=2' : '../index.html?cat=2'}">💓 Пульсометры</a>
    <a href="${activePage === 'index' ? 'index.html?cat=4' : '../index.html?cat=4'}">🚴 Велокомпьютеры</a>
    <a href="${activePage === 'index' ? 'index.html?cat=9' : '../index.html?cat=9'}">🗺️ GPS навигаторы</a>
    <a href="${activePage === 'index' ? 'index.html?sale=1' : '../index.html?sale=1'}" style="color:#f02424;">🔥 Распродажа</a>
    <a href="${activePage === 'index' ? 'pages/about.html' : 'about.html'}">ℹ️ О магазине</a>
    <a href="${activePage === 'index' ? 'pages/delivery.html' : 'delivery.html'}">🚚 Доставка</a>
    <a href="${activePage === 'index' ? 'pages/contacts.html' : 'contacts.html'}">📞 Контакты</a>
    <a href="${activePage === 'index' ? 'pages/cart.html' : 'cart.html'}">🛒 Корзина</a>
  </nav>
</header>
<div class="header-padding"></div>`;
}

// ===== ПОДВАЛ =====
function renderFooter(isSubpage) {
  const base = isSubpage ? '../' : '';
  return `
<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <h3>Vel<span>gar</span></h3>
        <p>Официальный магазин спортивной электроники Garmin, Polar, Suunto. Гарантия качества и быстрая доставка по всей России.</p>
        <div class="footer-contacts">
          <a href="tel:+70000000000">${SITE.phone}</a>
          <div class="city">Пн–Вс, 9:00–21:00</div>
          <a href="mailto:${SITE.email}">${SITE.email}</a>
          <div class="city">${SITE.address}</div>
        </div>
      </div>
      <div class="footer-col">
        <h4>Каталог</h4>
        <a href="${base}index.html?cat=1">Спортивные часы</a>
        <a href="${base}index.html?cat=2">Пульсометры</a>
        <a href="${base}index.html?cat=3">Дайвинг</a>
        <a href="${base}index.html?cat=4">Велокомпьютеры</a>
        <a href="${base}index.html?cat=9">GPS навигаторы</a>
        <a href="${base}index.html?cat=10">Эхолоты</a>
        <a href="${base}index.html?cat=6">Аксессуары</a>
      </div>
      <div class="footer-col">
        <h4>Информация</h4>
        <a href="${base}pages/about.html">О магазине</a>
        <a href="${base}pages/delivery.html">Доставка и оплата</a>
        <a href="${base}pages/guarantee.html">Гарантия и возврат</a>
        <a href="${base}pages/privacy.html">Политика конфиденциальности</a>
        <a href="${base}pages/contacts.html">Контакты</a>
      </div>
      <div class="footer-col">
        <h4>Мы в соцсетях</h4>
        <a href="${SITE.vk}" target="_blank">ВКонтакте</a>
        <div style="margin-top:16px;">
          <h4>Оплата</h4>
          <p style="font-size:12px;color:#969696;font-weight:600;margin-top:6px;">Оплата через СБП в чате с менеджером ВКонтакте</p>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <span>2024–2026 © Velgar. Все права защищены.</span>
      <span>${SITE.legal} · ИНН ${SITE.inn} · ОГРНИП ${SITE.ogrnip}</span>
    </div>
  </div>
</footer>`;
}
