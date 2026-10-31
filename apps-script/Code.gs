/**
 * Kitchen app – Google Sheet sync.
 *
 * Paste this into Extensions → Apps Script of your Google Sheet, then
 * Deploy → New deployment → Web app (see README.md).
 *
 * This script doesn't need to know what a recipe contains: it stores
 * each item as one block of data (JSON), so new app features work
 * without changing this script. A few columns are kept readable for you
 * (title, owner, last change).
 *
 * The app sends all its items; the script merges them with the Sheet
 * and sends the merged list back:
 *   - the newest version of each item wins ("updatedAt");
 *   - lists of timestamped entries (like each person's star rating)
 *     are merged entry by entry, so two phones never overwrite each other.
 */

// One sheet (tab) per kind of data. "recipes" keeps its old tab name.
const SHEET_NAMES = { recipes: "Recipes" };
const HEADERS = ["id", "title", "owner", "updatedAt", "deleted", "data"];
// Deleted items are kept as small markers so the deletion reaches
// every phone. After this many days the markers are removed.
const DELETED_KEEP_DAYS = 90;

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const request = JSON.parse(e.postData.contents);
    // Older app versions send { recipes: [...] }; newer may name a collection.
    const collection = request.collection || "recipes";
    const incoming = request.items || request.recipes || [];
    const sheet = getSheet_(collection);
    let items = readItems_(sheet);

    if (request.action === "sync") {
      items = mergeItems_(items, incoming);
      items = dropOldDeleted_(items);
      writeItems_(sheet, items);
    }
    const reply = { ok: true, items: items };
    reply[collection] = items; // so the app can read data.recipes
    return json_(reply);
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  } finally {
    lock.releaseLock();
  }
}

// Opening the link in a browser shows the recipes as JSON (a quick check).
function doGet() {
  return json_({ ok: true, app: "kitchen", recipes: readItems_(getSheet_("recipes")) });
}

function getSheet_(collection) {
  if (!/^[a-z][a-z0-9-]{0,30}$/.test(collection)) {
    throw new Error("Unknown collection: " + collection);
  }
  const name = SHEET_NAMES[collection] || collection;
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Reads all rows. Understands this script's format (a "data" column)
// and the older one-column-per-field format, which it converts.
function readItems_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) {
    return [];
  }
  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0].map(String);
  const dataColumn = headers.indexOf("data");
  const items = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    let item = null;
    if (dataColumn >= 0) {
      try {
        item = JSON.parse(row[dataColumn] || "null");
      } catch (error) {
        item = null; // a damaged row is skipped, not fatal
      }
    } else {
      item = fromOldRow_(headers, row);
    }
    if (item && item.id) {
      items.push(item);
    }
  }
  return items;
}

// Old format: one column per field (id, title, text, tags, ratings …).
function fromOldRow_(headers, row) {
  const item = {};
  headers.forEach(function (header, index) {
    if (header) {
      item[header] = row[index];
    }
  });
  if (!item.id) {
    return null;
  }
  item.id = String(item.id);
  item.updatedAt = Number(item.updatedAt) || 0;
  item.deleted = item.deleted === true || String(item.deleted).toUpperCase() === "TRUE";
  if (typeof item.tags === "string") {
    item.tags = item.tags.split(",").map(function (t) { return t.trim(); }).filter(String);
  }
  if (typeof item.ratings === "string") {
    try {
      item.ratings = JSON.parse(item.ratings || "{}");
    } catch (error) {
      item.ratings = {};
    }
  }
  if (item.servings !== undefined) {
    item.servings = Number(item.servings) || null;
  }
  return item;
}

function writeItems_(sheet, items) {
  // Clear everything (also old-format columns), then write fresh.
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow > 0 && lastColumn > 0) {
    sheet.getRange(1, 1, lastRow, lastColumn).clearContent();
  }
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
  sheet.setFrozenRows(1);
  if (!items.length) {
    return;
  }
  const rows = items.map(function (item) {
    return [
      item.id,
      item.title || "",
      item.owner || "",
      item.updatedAt ? new Date(item.updatedAt).toISOString() : "",
      item.deleted ? "TRUE" : "FALSE",
      JSON.stringify(item),
    ];
  });
  const range = sheet.getRange(2, 1, rows.length, HEADERS.length);
  // Plain text, so nothing is ever read as a formula or a date.
  range.setNumberFormat("@");
  range.setValues(rows);
}

// True for an object like { "Kadi": { stars: 5, at: 123 }, … }:
// every entry is an object with a numeric "at" time.
function isTimestampedMap_(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every(function (key) {
    const entry = value[key];
    return entry && typeof entry === "object" && typeof entry.at === "number";
  });
}

// For each key, the entry with the latest "at" wins.
function mergeTimestampedMaps_(a, b) {
  const result = {};
  [a || {}, b || {}].forEach(function (map) {
    Object.keys(map).forEach(function (key) {
      if (!result[key] || map[key].at > result[key].at) {
        result[key] = map[key];
      }
    });
  });
  return result;
}

function mergeItems_(stored, incoming) {
  const byId = {};
  stored.concat(incoming).forEach(function (item) {
    if (!item || !item.id) {
      return;
    }
    item.updatedAt = Number(item.updatedAt) || 0;
    const existing = byId[item.id];
    if (!existing) {
      byId[item.id] = item;
      return;
    }
    const newer = item.updatedAt > existing.updatedAt ? item : existing;
    const older = newer === item ? existing : item;
    const merged = JSON.parse(JSON.stringify(newer));
    if (!merged.deleted) {
      Object.keys(older).forEach(function (field) {
        const a = older[field];
        const b = merged[field];
        if ((isTimestampedMap_(a) || isTimestampedMap_(b)) &&
            (a === undefined || isTimestampedMap_(a) || isEmptyObject_(a)) &&
            (b === undefined || isTimestampedMap_(b) || isEmptyObject_(b))) {
          merged[field] = mergeTimestampedMaps_(a, b);
        }
      });
    }
    byId[item.id] = merged;
  });
  return Object.keys(byId).map(function (id) { return byId[id]; });
}

function isEmptyObject_(value) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

function dropOldDeleted_(items) {
  const cutoff = Date.now() - DELETED_KEEP_DAYS * 24 * 60 * 60 * 1000;
  return items.filter(function (item) {
    return !item.deleted || item.updatedAt > cutoff;
  });
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
