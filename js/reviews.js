// ===== NEOGAR — reviews.js =====
// Логика модуля отзывов: рендер карточек, пользовательский отзыв
// (localStorage), отправка в вебхук (опционально).
//
// На странице, где нужны отзывы, подключать в таком порядке:
//   <script src="../js/reviews-data.js"></script>
//   <script src="../js/reviews.js"></script>
//
// Зависимости: window.REVIEWS_DATA (из reviews-data.js), необязательно showToast()
// из app.js (если не определён — Reviews.showMsg fallback в alert).

(function () {
  'use strict';

  const USER_REVIEWS_KEY = 'gg_user_reviews';

  // URL вебхука для отправки в Google Sheets — можно оставить пустым,
  // тогда отзывы будут сохраняться только в localStorage.
  // Чтобы включить: вставить URL Apps Script-вебхука.
  window.REVIEW_WEBHOOK_URL = window.REVIEW_WEBHOOK_URL || '';

  // ===== Безопасные функции =====
  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showMsg(msg, kind) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg, kind || 'success');
    } else {
      alert(msg);
    }
  }

  function formatDate(iso) {
    // 2025-12-07 -> 7 декабря 2025
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  function starsHTML(rating) {
    rating = Math.max(0, Math.min(5, Number(rating) || 0));
    var html = '<span class="rev-stars" aria-label="' + rating + ' из 5">';
    for (var i = 1; i <= 5; i++) {
      var filled = i <= rating;
      html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="' +
              (filled ? '#c8a96e' : 'none') + '" stroke="#c8a96e" stroke-width="1.5">' +
              '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    }
    html += '</span>';
    return html;
  }

  // ===== Хранилище пользовательских отзывов =====
  const UserReviews = {
    get: function () {
      try {
        var raw = localStorage.getItem(USER_REVIEWS_KEY);
        if (!raw) return [];
        var arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      } catch (e) {
        return [];
      }
    },
    add: function (review) {
      var list = UserReviews.get();
      list.unshift(review); // в начало — новейший
      try {
        localStorage.setItem(USER_REVIEWS_KEY, JSON.stringify(list));
      } catch (e) {
        // localStorage quota — игнорируем
      }
      return list;
    }
  };

  // ===== Карточка отзыва =====
  function renderCard(r, isUserOwn) {
    var avatarHtml;
    if (r.avatar) {
      avatarHtml =
        '<img class="rev-avatar" src="' + escapeHTML(r.avatar) + '" alt="" loading="lazy"' +
        ' onerror="this.outerHTML=&quot;<div class=\\&quot;rev-avatar rev-avatar-fallback\\&quot;>' +
        escapeHTML((r.name || '?').charAt(0).toUpperCase()) + '</div>&quot;">';
    } else {
      avatarHtml =
        '<div class="rev-avatar rev-avatar-fallback">' +
        escapeHTML((r.name || '?').charAt(0).toUpperCase()) + '</div>';
    }

    var photoHtml = '';
    if (r.photo) {
      photoHtml =
        '<div class="rev-photo-wrap">' +
          '<img class="rev-photo" src="' + escapeHTML(r.photo) + '" alt="Фото товара от ' +
          escapeHTML(r.name || '') + '" loading="lazy"' +
          ' onclick="Reviews.openLightbox(this.src)" onerror="this.parentNode.style.display=\'none\'">' +
        '</div>';
    }

    var ownBadge = isUserOwn ?
      '<span class="rev-badge-own" title="Ваш отзыв — виден только вам пока не пройдёт модерацию">Ваш отзыв</span>' : '';

    return (
      '<article class="rev-card">' +
        '<header class="rev-head">' +
          avatarHtml +
          '<div class="rev-meta">' +
            '<div class="rev-name">' + escapeHTML(r.name || 'Покупатель') + ownBadge + '</div>' +
            '<div class="rev-sub">' + starsHTML(r.rating) +
              (r.date ? '<span class="rev-date">' + escapeHTML(formatDate(r.date)) + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</header>' +
        '<div class="rev-text">' + escapeHTML(r.text || '') + '</div>' +
        photoHtml +
      '</article>'
    );
  }

  // ===== Лайтбокс для фото =====
  function openLightbox(src) {
    var box = document.createElement('div');
    box.className = 'rev-lightbox';
    box.innerHTML = '<img src="' + escapeHTML(src) + '" alt=""><span class="rev-lightbox-close">✕</span>';
    box.addEventListener('click', function () { box.remove(); });
    document.body.appendChild(box);
  }

  // ===== Рендер списка =====
  // mode: 'full' (все) / 'preview' (N штук)
  function renderList(container, opts) {
    opts = opts || {};
    var data = (window.REVIEWS_DATA || []).slice();
    var userList = UserReviews.get();

    // Пользовательские в начало
    var combined = userList.map(function (r) { return { r: r, own: true }; })
                          .concat(data.map(function (r) { return { r: r, own: false }; }));

    if (opts.limit) combined = combined.slice(0, opts.limit);

    container.innerHTML = combined.map(function (x) { return renderCard(x.r, x.own); }).join('');
  }

  // ===== Форма «Оставить отзыв» =====
  function bindForm(form) {
    if (!form) return;

    // Звёзды
    var stars = form.querySelectorAll('.rev-form-star');
    var ratingInput = form.querySelector('input[name="rating"]');
    function paintStars(value) {
      stars.forEach(function (s, idx) {
        s.classList.toggle('active', (idx + 1) <= value);
      });
    }
    stars.forEach(function (s, idx) {
      s.addEventListener('click', function () {
        var val = idx + 1;
        ratingInput.value = val;
        paintStars(val);
      });
      s.addEventListener('mouseenter', function () { paintStars(idx + 1); });
    });
    var starsRow = form.querySelector('.rev-form-stars');
    if (starsRow) {
      starsRow.addEventListener('mouseleave', function () {
        paintStars(Number(ratingInput.value) || 0);
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = (form.elements['name'].value || '').trim();
      var text = (form.elements['text'].value || '').trim();
      var rating = Number(form.elements['rating'].value) || 0;

      if (!name) { showMsg('Укажите имя', ''); form.elements['name'].focus(); return; }
      if (!text || text.length < 10) { showMsg('Напишите отзыв (минимум 10 символов)', ''); form.elements['text'].focus(); return; }
      if (!rating) { showMsg('Поставьте оценку (1–5 звёзд)', ''); return; }

      var review = {
        name:   name.slice(0, 80),
        text:   text.slice(0, 2000),
        rating: rating,
        date:   new Date().toISOString().slice(0, 10),
        // avatar и photo пользователь не загружает (статический сайт)
        avatar: '',
        photo:  ''
      };

      // 1) Сразу сохраняем в localStorage и обновляем список —
      // отзыв сразу появляется у автора.
      UserReviews.add(review);

      // 2) Отправляем в вебхук (если настроен) — без ожидания, UX не блокируем.
      var url = window.REVIEW_WEBHOOK_URL;
      if (url) {
        try {
          fetch(url, {
            method:  'POST',
            mode:    'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body:    JSON.stringify({ type: 'review', payload: review })
          }).catch(function () { /* тихо игнорируем */ });
        } catch (e) {}
      }

      // 3) Сообщение и сброс формы
      showMsg('Спасибо! Ваш отзыв опубликован.', 'success');
      form.reset();
      paintStars(0);

      // 4) Перерисовываем список
      var listEl = document.getElementById('reviewsList');
      if (listEl) renderList(listEl);

      // 5) Метрика
      try { if (window.ym) ym(108563480, 'reachGoal', 'review_submit'); } catch (e) {}
    });
  }

  // ===== Публичный API =====
  window.Reviews = {
    renderList:     renderList,
    bindForm:       bindForm,
    openLightbox:   openLightbox,
    UserReviews:    UserReviews,
    starsHTML:      starsHTML,
    formatDate:     formatDate
  };
})();
