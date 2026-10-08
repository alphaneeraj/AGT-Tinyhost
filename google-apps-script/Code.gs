/**
 * AGT free lead inbox – Google Apps Script web app (costs nothing).
 *
 * - The quote form on the website POSTs here; each lead becomes a row in the "Leads" sheet.
 * - The live admin (/admin/ → Leads) reads, updates and deletes rows using the secret key.
 *
 * Setup: see README.md → "Free lead inbox (Google Sheet)".
 */

// Change this to a long random string. You'll type the same value as the "Leads key" in the admin.
const SECRET = 'CHANGE-ME-TO-A-LONG-RANDOM-SECRET';

const SHEET_NAME = 'Leads';
const FIELDS = [
  'name', 'email', 'phone', 'from_city', 'to_city', 'depart_date', 'return_date',
  'passengers', 'trip_type', 'cabin', 'message', 'source_page', 'utm',
];
const HEADER = ['id', 'created_at'].concat(FIELDS).concat(['status', 'notes']);
const STATUSES = ['new', 'contacted', 'quoted', 'booked', 'closed', 'spam'];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Plain-text cells so dates and phone numbers are stored exactly as typed.
    sheet.getRange(1, 1, sheet.getMaxRows(), HEADER.length).setNumberFormat('@');
    sheet.appendRow(HEADER);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function clip_(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

// Stop Sheets from treating text such as "=SUM(...)" or "+1 555..." as a formula.
function asText_(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function authorized_(token) {
  return token && SECRET.indexOf('CHANGE-ME') !== 0 && token === SECRET;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function findRow_(sheet, id) {
  const ids = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}

/** Website form submissions (form-encoded) and admin actions (JSON with the secret). */
function doPost(e) {
  const body = e && e.postData && e.postData.contents;
  if (body && body.charAt(0) === '{') return adminAction_(JSON.parse(body));

  const p = (e && e.parameter) || {};
  const lead = {};
  FIELDS.forEach(function (f) { lead[f] = clip_(p[f], f === 'message' ? 2000 : 300); });

  const ts = Number(p.ts);
  const isBot = !!p.website || (ts && Date.now() - ts < 2500);
  const valid = lead.name && (lead.phone || lead.email);

  if (!isBot && valid) {
    withLock_(function () {
      getSheet_().appendRow(
        [Utilities.getUuid(), new Date().toISOString()]
          .concat(FIELDS.map(function (f) { return asText_(lead[f]); }))
          .concat(['new', '']),
      );
    });
  }

  // Only seen by visitors with JavaScript turned off (normally the site shows its own thank-you page).
  return HtmlService.createHtmlOutput(
    '<p style="font-family:Arial;font-size:18px">' +
      (valid ? 'Thank you! A group travel specialist will contact you shortly.' : 'Please go back and fill in your name and phone or email.') +
      '</p><p style="font-family:Arial">Call us 24/7: <a href="tel:+18886091015" target="_top">+1-888-609-1015</a></p>',
  );
}

/** Admin: update status/notes or delete a lead. Body: {token, action, id, status?, notes?} */
function adminAction_(req) {
  if (!authorized_(req.token)) return json_({ ok: false, error: 'unauthorized' });
  return withLock_(function () {
    const sheet = getSheet_();
    const row = findRow_(sheet, String(req.id || ''));
    if (!row) return json_({ ok: false, error: 'not found' });
    if (req.action === 'delete') {
      sheet.deleteRow(row);
      return json_({ ok: true });
    }
    if (req.action === 'update') {
      if (req.status !== undefined) {
        if (STATUSES.indexOf(req.status) === -1) return json_({ ok: false, error: 'bad status' });
        sheet.getRange(row, HEADER.indexOf('status') + 1).setValue(req.status);
      }
      if (req.notes !== undefined) sheet.getRange(row, HEADER.indexOf('notes') + 1).setValue(asText_(clip_(req.notes, 5000)));
      return json_({ ok: true });
    }
    return json_({ ok: false, error: 'unknown action' });
  });
}

/** Admin: list leads, newest first. Requires ?token=SECRET. */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!authorized_(p.token)) return json_({ ok: false, error: 'unauthorized' });
  const values = getSheet_().getDataRange().getValues();
  const header = values.shift() || HEADER;
  const limit = Math.min(Number(p.limit) || 1000, 5000);
  const rows = values.slice(-limit).reverse().map(function (row) {
    const obj = {};
    header.forEach(function (h, i) {
      const v = row[i];
      obj[h] = v instanceof Date
        ? (h === 'created_at' ? v.toISOString() : Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd'))
        : String(v);
    });
    obj.status = obj.status || 'new';
    return obj;
  });
  return json_({ ok: true, leads: rows });
}
