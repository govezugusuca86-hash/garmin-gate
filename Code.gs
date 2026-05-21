/**
 * Neogar.ru — приём заказов с сайта.
 *  - пишет заказ в Google Sheets (лист «Заказы»),
 *  - отправляет уведомление в Telegram (бот → твой chat_id),
 *  - возвращает на сайт номер заказа NEO-0001.
 *
 * ============================================================
 *  УСТАНОВКА (один раз)
 * ============================================================
 *  1. Создай или открой Google-таблицу для заказов.
 *  2. Расширения → Apps Script.
 *  3. Удали всё из Code.gs, вставь этот файл, сохрани (Ctrl+S).
 *  4. Заполни константы TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID для уведомлений
 *     (если не нужны — оставь пустыми, заказы всё равно пишутся в Sheets).
 *  5. ⚙️ Project Settings → Script Properties → Add property:
 *       Property: lastOrderNumber
 *       Value:    986
 *     Это сделает первый новый заказ NEO-0987.
 *     (Если уже выдавались номера через старый скрипт — поставь
 *      нужное значение N-1, где N — желаемый следующий номер.)
 *  6. Развернуть → Новое развёртывание → Тип: Веб-приложение.
 *       Выполнять от имени: «Я».
 *       Доступ: «Все».
 *     Скопируй URL …/exec — он идёт в js/app.js → ORDER_WEBHOOK_URL.
 *  7. При первом запуске Apps Script спросит разрешения (Sheets + UrlFetch).
 *
 *  Обновление кода:
 *    Развернуть → Управление развёртываниями → ✏️ → Версия «Новая» → Развернуть.
 *    URL не меняется.
 *
 *  ============================================================
 *   ИЗМЕНЕНИЯ В ЭТОЙ ВЕРСИИ
 *  ============================================================
 *   - Форма оформления заказа на сайте УБРАНА. Из корзины клиент
 *     сразу попадает на страницу подтверждения с кнопками
 *     «Написать в Telegram / MAX». В Sheets заказ пишется
 *     анонимно — только состав, сумма, дата и временный статус
 *     «⏳ Ждём сообщения».
 *   - Колонка «Статус» добавлена первой после даты, чтобы было
 *     удобно сортировать и видеть, какие заказы уже подтверждены
 *     мессенджером, а какие ещё нет.
 *   - Старые поля (fullName / contact / email / phone) по-прежнему
 *     принимаются — на случай, если кто-то возродит форму.
 *   - Дедупликация для анонимных заказов считается по User-Agent
 *     + состав, чтобы разные клиенты с одинаковой корзиной
 *     не схлопывались в один заказ за 60 секунд.
 */

// ===== Настройки =====
var TELEGRAM_BOT_TOKEN = '';                  // вписать токен от @BotFather
var TELEGRAM_CHAT_ID   = '8306869104';        // твой chat_id

var SHEET_NAME   = 'Заказы';
var ORDER_PREFIX = 'NEO-';
var ORDER_PAD    = 4;             // NEO-0987
var DUPLICATE_WINDOW_SEC = 60;    // окно защиты от дублей

var HEADERS = [
  'Номер заказа', 'Дата', 'Статус',
  'ФИ', 'Контакт (Telegram/телефон)', 'Email',
  'Самовывоз/Доставка',
  'Товары', 'Кол-во позиций', 'Сумма, ₽',
  'Комментарий', 'User-Agent', 'Referer'
];

// ============================================================
// HTTP handlers
// ============================================================
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var payload = JSON.parse(e.postData.contents);

    // --- honeypot: если бот заполнил скрытое поле — молча отбрасываем ---
    if (payload.website) {
      return jsonResponse({ ok: true, orderNumber: 'NEO-IGNORED' });
    }

    // --- разбор полей ---
    var fullName = String(payload.fullName || '').trim();
    var contact  = String(payload.contact || payload.phone || '').trim();
    var email    = String(payload.email    || '').trim();
    var items    = Array.isArray(payload.items) ? payload.items : [];
    var isAnonymous = !!payload.anonymous || (!fullName && !contact && !email);

    // --- валидация: обязательны только товары; ФИ/контакт могут отсутствовать ---
    if (email && !isValidEmail(email)) return jsonResponse({ ok:false, error:'email invalid' });
    if (items.length === 0)            return jsonResponse({ ok:false, error:'items empty' });

    // --- защита от дублей ---
    // Для именованных заказов: ФИ + контакт + состав.
    // Для анонимных: UA + состав (чтобы не схлопывать разных клиентов с одинаковой корзиной).
    var dedupKey = isAnonymous
      ? makeAnonymousDedupKey(String(payload.userAgent || ''), items)
      : makeDedupKey(fullName, contact, items);
    var props = PropertiesService.getScriptProperties();
    var lastDedup = props.getProperty('dedup_' + dedupKey);
    if (lastDedup) {
      var parts = lastDedup.split('|');
      var ts = Number(parts[0]);
      var prevOrder = parts[1];
      if (ts && (Date.now() - ts) < DUPLICATE_WINDOW_SEC * 1000) {
        return jsonResponse({ ok:true, orderNumber: prevOrder, duplicate:true });
      }
    }

    // --- номер заказа ---
    var orderNumber = nextOrderNumber();

    // --- доставка (упрощено: только флаг, детали — в комментарии/мессенджере) ---
    var delivery = payload.delivery || {};
    var deliveryNeeded = !!delivery.needed;
    var comment        = String(payload.comment || '').trim();

    // --- состав и сумма ---
    var itemsText = items.map(function (it) {
      var brand = String(it.brand || '').trim();
      var name  = String(it.name  || '#' + it.id).trim();
      var price = Number(it.price) || 0;
      var qty   = Number(it.qty)   || 1;
      return (brand ? brand + ' ' : '') + name + ' × ' + qty + ' = ' + (price * qty) + ' ₽';
    }).join('\n');

    var totalQty = items.reduce(function (s, it) { return s + (Number(it.qty) || 1); }, 0);
    var total = Number(payload.total) || items.reduce(function (s, it) {
      return s + (Number(it.price) || 0) * (Number(it.qty) || 1);
    }, 0);

    // --- статус: для анонимных подсвечиваем явно ---
    var status = isAnonymous
      ? '⏳ Ждём сообщения'
      : '🆕 Новый';

    // --- 1. Sheets (первичное хранилище — пишем СНАЧАЛА) ---
    getOrCreateSheet().appendRow([
      orderNumber, new Date(), status,
      fullName || '—',
      contact  || '—',
      email,
      deliveryNeeded ? 'Нужна доставка' : 'Самовывоз (Саранск)',
      itemsText, totalQty, total,
      comment, String(payload.userAgent || ''), String(payload.referer || '')
    ]);

    // --- 2. Telegram (best-effort) ---
    try {
      sendTelegram(buildTelegramMessage({
        orderNumber: orderNumber, fullName: fullName,
        contact: contact, email: email,
        items: items, total: total, totalQty: totalQty,
        deliveryNeeded: deliveryNeeded,
        comment: comment,
        isAnonymous: isAnonymous
      }));
    } catch (tgErr) {
      console.error('Telegram notification failed:', tgErr);
    }

    // --- сохраняем dedup-ключ ---
    props.setProperty('dedup_' + dedupKey, Date.now() + '|' + orderNumber);

    return jsonResponse({ ok:true, orderNumber: orderNumber });
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok:false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return jsonResponse({ ok:true, service:'neogar-orders' });
}

// ============================================================
// Sheets
// ============================================================
function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    initHeaders(sheet);
  } else if (sheet.getLastRow() === 0) {
    initHeaders(sheet);
  }
  return sheet;
}

function initHeaders(sheet) {
  sheet.appendRow(HEADERS);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 110); // номер
  sheet.setColumnWidth(2, 130); // дата
  sheet.setColumnWidth(3, 140); // статус
  sheet.setColumnWidth(4, 180); // фи
  sheet.setColumnWidth(5, 200); // контакт
  sheet.setColumnWidth(8, 320); // товары
}

// ============================================================
// Номер заказа
// ============================================================
function nextOrderNumber() {
  var props = PropertiesService.getScriptProperties();
  // Если lastOrderNumber не задан — стартуем с 986, чтобы первый был NEO-0987.
  var last = Number(props.getProperty('lastOrderNumber') || '986');
  var next = last + 1;
  props.setProperty('lastOrderNumber', String(next));
  return ORDER_PREFIX + padLeft(next, ORDER_PAD);
}

function padLeft(num, len) {
  var s = String(num);
  while (s.length < len) s = '0' + s;
  return s;
}

// ============================================================
// Валидация
// ============================================================
function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function makeDedupKey(fullName, contact, items) {
  var name = String(fullName || '').toLowerCase().replace(/\s+/g, '');
  var c    = String(contact  || '').toLowerCase().replace(/\s+/g, '');
  var ids  = items.map(function (i) { return i.id + 'x' + i.qty; }).sort().join(',');
  return name + '|' + c + ':' + ids;
}

function makeAnonymousDedupKey(userAgent, items) {
  // Простой хеш UA: первые 16 значимых символов + длина — этого достаточно,
  // чтобы один и тот же клиент с одной корзиной не создавал дубль за 60 секунд,
  // и при этом разные клиенты не схлопывались.
  var ua = String(userAgent || '').replace(/\s+/g, '').slice(0, 24);
  var ids = items.map(function (i) { return i.id + 'x' + i.qty; }).sort().join(',');
  return 'anon|' + ua + ':' + ids;
}

// ============================================================
// Telegram
// ============================================================
function buildTelegramMessage(o) {
  var L = [];
  L.push('🛒 <b>НОВЫЙ ЗАКАЗ ' + escapeHtml(o.orderNumber) + '</b>');
  L.push('━━━━━━━━━━━━━━━━━━━━');
  if (o.isAnonymous) {
    L.push('⏳ <b>Ждём сообщения от клиента</b>');
    L.push('<i>Контакты не оставлены — клиент должен написать сам с номером заказа.</i>');
  } else {
    if (o.fullName) L.push('👤 ' + escapeHtml(o.fullName));
    if (o.contact)  L.push('💬 ' + escapeHtml(o.contact));
    if (o.email)    L.push('📧 <a href="mailto:' + escapeAttr(o.email) + '">' + escapeHtml(o.email) + '</a>');
  }
  L.push('');
  L.push('<b>📦 Состав (' + o.totalQty + ' шт.):</b>');
  o.items.forEach(function (it) {
    var brand = it.brand ? (it.brand + ' ') : '';
    var name = it.name || ('#' + it.id);
    L.push('• ' + escapeHtml(brand + name) + ' × ' + it.qty + ' = ' + formatRub(it.price * it.qty));
  });
  L.push('');
  L.push('💰 <b>Итого: ' + formatRub(o.total) + '</b>');
  if (!o.isAnonymous) {
    L.push('');
    if (o.deliveryNeeded) {
      L.push('🚚 <b>Нужна доставка</b> (детали уточнит клиент)');
    } else {
      L.push('🏬 <b>Самовывоз:</b> ТЦ Талисман, Саранск');
    }
    if (o.comment) {
      L.push('');
      L.push('💬 <i>' + escapeHtml(o.comment) + '</i>');
    }
  }
  return L.join('\n');
}

function sendTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  var url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });
}

function formatRub(n) {
  return Number(n).toLocaleString('ru-RU') + ' ₽';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, function (c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c];
  });
}
function escapeAttr(s) {
  return String(s).replace(/["'<>&]/g, function (c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

// ============================================================
// Утилиты
// ============================================================
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Можно вызвать вручную в редакторе Apps Script для теста уведомления.
function testTelegram() {
  sendTelegram('🛒 <b>ТЕСТ</b>\nЕсли видишь это сообщение — Telegram-уведомления работают.');
}

// Вспомогалка: сбросить серверный счётчик заказов до значения N (выдаст следующий N+1).
// Запускай вручную из редактора, поменяв число.
function setOrderCounter() {
  var N = 986; // следующий заказ будет NEO-0987
  PropertiesService.getScriptProperties().setProperty('lastOrderNumber', String(N));
  Logger.log('lastOrderNumber = ' + N + ' → next order: NEO-' + padLeft(N + 1, ORDER_PAD));
}
