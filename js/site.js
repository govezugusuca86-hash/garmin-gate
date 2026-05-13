// ===== NEOGAR — site.js =====
// Единая точка правды для шапки/подвала.
// Использование на странице:
//   <body data-page="index">   // значения: index, about, cart, favorites, product,
//                               //           contacts, delivery, guarantee, privacy,
//                               //           oferta, success
//   <div data-mount="header"></div>
//   ...основной контент...
//   <div data-mount="footer"></div>
//   <script src="js/site.js"></script>      <!-- из корня -->
//   <script src="../js/site.js"></script>   <!-- из pages/ -->
//
// site.js сам определяет уровень страницы (корень или pages/) по location.pathname,
// собирает HTML шапки/подвала и подставляет на место плейсхолдеров, затем
// инициализирует hamburger и счётчик корзины.

(function () {
  'use strict';

  const SITE = {
    name: 'Neogar',
    phone: '+7 (8342) 20-60-61',
    email: 'info@neogar.ru',
    address: 'г. Саранск, ул. Гожувская, 41А (ТЦ Талисман)',
    vk: 'https://vk.com/neogar_shop',
    legal: 'ИП Ущев Михаил Викторович',
    inn: '132810559995',
    ogrnip: '306132812300012',
  };
  window.SITE = SITE;

  function isSubpage() {
    return /\/pages\//.test(location.pathname);
  }

  function rootPrefix() {
    return isSubpage() ? '../' : '';
  }

  function pagesPrefix() {
    return isSubpage() ? '' : 'pages/';
  }

  function headerHTML(activePage) {
    const root = rootPrefix();
    const pages = pagesPrefix();
    const active = (p) => activePage === p ? 'class="active"' : '';
    return `
<header class="header">
  <div class="header-top">
    🚚 Доставка по всей России — СДЭК, Яндекс Доставка, Почта России &nbsp;|&nbsp;
    <a href="${SITE.vk}" target="_blank" rel="noopener" style="color:#fff;text-decoration:underline;">ВКонтакте</a>
  </div>
  <div class="container">
    <div class="header-main">
      <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
      <a href="${root}index.html" class="header-logo">Neo<span>gar</span></a>
      <nav class="header-nav">
        <a href="${root}index.html" ${active('index')}>Каталог</a>
        <a href="${root}index.html?cat=1">Часы</a>
        <a href="${root}index.html?cat=4">Велокомпьютеры</a>
        <a href="${root}index.html?cat=9">Навигаторы</a>
        <a href="${pages}about.html" ${active('about')}>О магазине</a>
        <a href="${root}index.html?sale=1" style="color:#f02424;">Распродажа</a>
      </nav>
      <div class="header-actions">
        <a href="${pages}cart.html" class="btn-icon" title="Корзина">
          <svg width="22" height="22" viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 15C5 13.9 5.9 13 7 13h20c1.1 0 2 .9 2 2v13c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V15z"/><path d="M23 12V8c0-1.7-1.3-3-3-3h-6C12.3 5 11 6.3 11 8v4"/></svg>
          <span class="badge cart-badge" style="display:none">0</span>
        </a>
        <a href="${pages}favorites.html" class="btn-icon" title="Избранное">
          <svg width="22" height="22" viewBox="0 0 20 19" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.33 2.8L10 3.41l.67-.61C12.6 1.05 15.58 1.11 17.43 2.99c1.93 1.95 1.93 5.12 0 7.07L10.69 16.89c-.38.38-.99.38-1.37 0L2.56 10.06C.64 8.11.64 4.94 2.56 2.99 4.42 1.11 7.39 1.05 9.33 2.8z"/></svg>
        </a>
      </div>
    </div>
  </div>
  <nav class="mobile-menu" id="mobileMenu">
    <a href="${root}index.html">🏠 Главная</a>
    <a href="${root}index.html?cat=1">⌚ Спортивные часы</a>
    <a href="${root}index.html?cat=2">💓 Пульсометры</a>
    <a href="${root}index.html?cat=4">🚴 Велокомпьютеры</a>
    <a href="${root}index.html?cat=9">🗺️ GPS навигаторы</a>
    <a href="${root}index.html?sale=1" style="color:#f02424;">🔥 Распродажа</a>
    <a href="${pages}about.html">ℹ️ О магазине</a>
    <a href="${pages}delivery.html">🚚 Доставка</a>
    <a href="${pages}contacts.html">📞 Контакты</a>
    <a href="${pages}cart.html">🛒 Корзина</a>
  </nav>
</header>
<div class="header-padding"></div>`;
  }

  function footerHTML() {
    const root = rootPrefix();
    const pages = pagesPrefix();
    return `
<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <h3>Neo<span>gar</span></h3>
        <p>Официальный магазин спортивной электроники Garmin, Polar, Suunto. Гарантия качества и быстрая доставка по всей России.</p>
        <div class="footer-contacts">
          <a href="tel:+78342206061">${SITE.phone}</a>
          <div class="city">Пн–Вс, 10:00–21:00</div>
          <a href="mailto:${SITE.email}">${SITE.email}</a>
          <div class="city">${SITE.address}</div>
        </div>
      </div>
      <div class="footer-col">
        <h4>Каталог</h4>
        <a href="${root}index.html?cat=1">Спортивные часы</a>
        <a href="${root}index.html?cat=2">Пульсометры</a>
        <a href="${root}index.html?cat=3">Дайвинг</a>
        <a href="${root}index.html?cat=4">Велокомпьютеры</a>
        <a href="${root}index.html?cat=9">GPS навигаторы</a>
        <a href="${root}index.html?cat=10">Эхолоты</a>
        <a href="${root}index.html?cat=6">Аксессуары</a>
      </div>
      <div class="footer-col">
        <h4>Информация</h4>
        <a href="${pages}about.html">О магазине</a>
        <a href="${pages}delivery.html">Доставка и оплата</a>
        <a href="${pages}guarantee.html">Гарантия и возврат</a>
        <a href="${pages}privacy.html">Политика конфиденциальности</a>
        <a href="${pages}contacts.html">Контакты</a>
      </div>
      <div class="footer-col">
        <h4>Мы в соцсетях</h4>
        <a href="${SITE.vk}" target="_blank" rel="noopener">ВКонтакте</a>
        <div style="margin-top:16px;">
          <h4>Оплата</h4>
          <p style="font-size:12px;color:#969696;font-weight:600;margin-top:6px;">Оплата через СБП в чате с менеджером ВКонтакте</p>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <span>2024–2026 © Neogar. Все права защищены.</span>
      <span>${SITE.legal} · ИНН ${SITE.inn} · ОГРНИП ${SITE.ogrnip}</span>
    </div>
  </div>
</footer>`;
  }

  function initHamburger() {
    const hamb = document.getElementById('hamburger');
    const menu = document.getElementById('mobileMenu');
    if (hamb && menu) {
      hamb.addEventListener('click', () => menu.classList.toggle('open'));
    }
  }

  // Бэдж корзины обновляется при монтировании и после Cart.save (см. app.js).
  function updateCartBadge() {
    if (typeof Cart === 'undefined') return;
    const cnt = Cart.count();
    document.querySelectorAll('.cart-badge').forEach((el) => {
      el.textContent = cnt;
      el.style.display = cnt > 0 ? 'flex' : 'none';
    });
  }
  window.updateCartBadge = updateCartBadge;

  function mountChrome() {
    const activePage = (document.body && document.body.dataset.page) || '';

    const headerSlot = document.querySelector('[data-mount="header"]');
    if (headerSlot) headerSlot.outerHTML = headerHTML(activePage);

    const footerSlot = document.querySelector('[data-mount="footer"]');
    if (footerSlot) footerSlot.outerHTML = footerHTML();

    initHamburger();
    updateCartBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountChrome);
  } else {
    mountChrome();
  }
})();
