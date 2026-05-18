/**
 * Neogar.ru — приём заказов из формы checkout и запись в Google Sheets.
 *
 * УСТАНОВКА (один раз):
 * 1. Создай новую Google-таблицу (или открой существующую).
 * 2. Расширения → Apps Script.
 * 3. Замени содержимое Code.gs на этот файл, сохрани (Ctrl+S).
 * 4. Развернуть → Новое развёртывание → ⚙ → Веб-приложение.
 *    - Выполнять от имени: «Я».
 *    - У кого есть доступ: «Все».
 * 5. Скопируй URL развёртывания (.../exec).
 *    Подставь его в js/app.js → ORDER_WEBHOOK_URL.
 *
 * При изменении кода: Развернуть → Управление развёртываниями → ✏️ → Новая версия.
 */

var SHEET_NAME   = 'Заказы';
var ORDER_PREFIX = 'NEO-';
var ORDER_PAD    = 4;          // NEO-0001
var HEADERS = [
  'Номер заказа', 'Дата', 'ФИ', 'Телефон', 'Email',
  'Товары', 'Количество позиций', 'Сумма, ₽',
  'User-Agent', 'Referer'
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var payload = JSON.parse(e.postData.contents);

    var fullName = String(payload.fullName || '').trim();
    var phone    = String(payload.phone    || '').trim();
    var email    = String(payload.email    || '').trim();
    var items    = Array.isArray(payload.items) ? payload.items : [];

    if (!fullName)             return jsonResponse({ ok:false, error:'fullName required' });
    if (!phone && !email)      return jsonResponse({ ok:false, error:'phone or email required' });
    if (items.length === 0)    return jsonResponse({ ok:false, error:'items empty' });

    var orderNumber = nextOrderNumber();
    var sheet = getOrCreateSheet();

    var itemsText = items.map(function (it) {
      var name  = String(it.name || it.title || ('#' + it.id)).trim();
      var brand = String(it.brand || '').trim();
      var price = Number(it.price) || 0;
      var qty   = Number(it.qty)   || 1;
      var prefix = brand ? (brand + ' ') : '';
      return prefix + name + ' × ' + qty + ' = ' + (price * qty) + ' ₽';
    }).join('\n');

    var totalQty = items.reduce(function (s, it) { return s + (Number(it.qty) || 1); }, 0);
    var total    = Number(payload.total) || items.reduce(function (s, it) {
      return s + (Number(it.price) || 0) * (Number(it.qty) || 1);
    }, 0);

    sheet.appendRow([
      orderNumber, new Date(), fullName, phone, email,
      itemsText, totalQty, total,
      String(payload.userAgent || ''), String(payload.referer || '')
    ]);

    return jsonResponse({ ok:true, orderNumber: orderNumber });
  } catch (err) {
    return jsonResponse({ ok:false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return jsonResponse({ ok:true, service:'neogar-orders' });
}

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

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
