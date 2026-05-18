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
 *  4. Заполни три константы ниже:
 *       TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID  — для уведомлений
 *       (если не нужны TG-уведомления — оставь пустыми, заказы всё равно пишутся в Sheets)
 *  5. Развернуть → Новое развёртывание → Тип: Веб-приложение.
 *       Выполнять от имени: «Я».
 *       Доступ: «Все».
 *     Скопируй URL вида …/exec — он пойдёт в js/app.js → ORDER_WEBHOOK_URL.
 *  6. При первом запуске Apps Script спросит разрешения (Sheets + UrlFetch) — разреши.
 *
 *  Как получить TELEGRAM_BOT_TOKEN:
 *    Открой в Telegram @BotFather → /newbot → следуй инструкциям → скопируй токен.
 *
 *  Как получить TELEGRAM_CHAT_ID:
 *    Открой в Telegram @userinfobot → напиши ему /start → он пришлёт твой ID.
 *    Затем напиши своему боту /start (чтобы он мог тебе писать).
 *
 *  Обновление кода:
 *    Развернуть → Управление развёртываниями → ✏️ → Версия «Новая» → Развернуть.
 *    URL не меняется.
 */

// ===== Настройки =====
var TELEGRAM_BOT_TOKEN = '';                  // вписать токен от @BotFather (например '7123456789:AAH...')
var TELEGRAM_CHAT_ID   = '8306869104';        // твой chat_id (уже подставлен)

var SHEET_NAME   = 'Заказы';
var ORDER_PREFIX = 'NEO-';
var ORDER_PAD    = 4;             // NEO-0001
var DUPLICATE_WINDOW_SEC = 60;    // окно защиты от дублей: одинаковый заказ в течение N секунд игнорим

var HEADERS = [
  'Номер заказа', 'Дата', 'ФИ', 'Телефон', 'Email',
  'Самовывоз/Доставка', 'Способ доставки', 'Город', 'Адрес',
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

    // --- валидация ---
    var fullName = String(payload.fullName || '').trim();
    var phone    = String(payload.phone    || '').trim();
    var email    = String(payload.email    || '').trim();
    var items    = Array.isArray(payload.items) ? payload.items : [];

    if (!fullName)           return jsonResponse({ ok:false, error:'fullName required' });
    if (!isValidPhone(phone))return jsonResponse({ ok:false, error:'phone invalid' });
    if (email && !isValidEmail(email)) return jsonResponse({ ok:false, error:'email invalid' });
    if (items.length === 0)  return jsonResponse({ ok:false, error:'items empty' });

    // --- защита от дублей: если такой же заказ был N секунд назад — возвращаем тот же номер ---
    var dedupKey = makeDedupKey(phone, items);
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

    // --- доставка ---
    var delivery = payload.delivery || {};
    var deliveryNeeded = !!delivery.needed;
    var deliveryMethod = deliveryNeeded ? String(delivery.method || '').trim() : 'Самовывоз';
    var deliveryCity   = deliveryNeeded ? String(delivery.city   || '').trim() : 'Саранск (ТЦ Талисман)';
    var deliveryAddr   = deliveryNeeded ? String(delivery.address|| '').trim() : '';
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

    // --- 1. Sheets (первичное хранилище — пишем СНАЧАЛА) ---
    getOrCreateSheet().appendRow([
      orderNumber, new Date(), fullName, phone, email,
      deliveryNeeded ? 'Доставка' : 'Самовывоз',
      deliveryMethod, deliveryCity, deliveryAddr,
      itemsText, totalQty, total,
      comment, String(payload.userAgent || ''), String(payload.referer || '')
    ]);

    // --- 2. Telegram (best-effort, ошибки только логируем) ---
    try {
      sendTelegram(buildTelegramMessage({
        orderNumber: orderNumber, fullName: fullName, phone: phone, email: email,
        items: items, total: total, totalQty: totalQty,
        deliveryNeeded: deliveryNeeded, deliveryMethod: deliveryMethod,
        deliveryCity: deliveryCity, deliveryAddr: deliveryAddr,
        comment: comment
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
  // Удобные ширины
  sheet.setColumnWidth(1, 110); // номер
  sheet.setColumnWidth(2, 130); // дата
  sheet.setColumnWidth(3, 180); // фи
  sheet.setColumnWidth(4, 140); // телефон
  sheet.setColumnWidth(10, 320); // товары
}

// ============================================================
// Номер заказа
// ============================================================
function nextOrderNumber() {
  var props = PropertiesService.getScriptProperties();
  var last = Number(props.getProperty('lastOrderNumber') || '0');
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
function isValidPhone(s) {
  if (!s) return false;
  var digits = s.replace(/\D/g, '');
  return digits.length === 11 && /^[78]/.test(digits);
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function makeDedupKey(phone, items) {
  var digits = String(phone || '').replace(/\D/g, '');
  var ids = items.map(function (i) { return i.id + 'x' + i.qty; }).sort().join(',');
  return digits + ':' + ids;
}

// ============================================================
// Telegram
// ============================================================
function buildTelegramMessage(o) {
  var L = [];
  L.push('🛒 <b>НОВЫЙ ЗАКАЗ ' + escapeHtml(o.orderNumber) + '</b>');
  L.push('━━━━━━━━━━━━━━━━━━━━');
  L.push('👤 ' + escapeHtml(o.fullName));
  L.push('📱 <a href="tel:' + escapeAttr(o.phone) + '">' + escapeHtml(o.phone) + '</a>');
  if (o.email) L.push('📧 <a href="mailto:' + escapeAttr(o.email) + '">' + escapeHtml(o.email) + '</a>');
  L.push('');
  L.push('<b>📦 Состав (' + o.totalQty + ' шт.):</b>');
  o.items.forEach(function (it) {
    var brand = it.brand ? (it.brand + ' ') : '';
    var name = it.name || ('#' + it.id);
    L.push('• ' + escapeHtml(brand + name) + ' × ' + it.qty + ' = ' + formatRub(it.price * it.qty));
  });
  L.push('');
  L.push('💰 <b>Итого: ' + formatRub(o.total) + '</b>');
  L.push('');
  if (o.deliveryNeeded) {
    L.push('🚚 <b>Доставка:</b> ' + escapeHtml(o.deliveryMethod || '—'));
    if (o.deliveryCity) L.push('🏙 Город: ' + escapeHtml(o.deliveryCity));
    if (o.deliveryAddr) L.push('📍 Адрес: ' + escapeHtml(o.deliveryAddr));
  } else {
    L.push('🏬 <b>Самовывоз:</b> ТЦ Талисман, Саранск');
  }
  if (o.comment) {
    L.push('');
    L.push('💬 <i>' + escapeHtml(o.comment) + '</i>');
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
