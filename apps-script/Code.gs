/**
 * Kitchen app – Google Sheet sync.
 *
 * Paste this into Extensions → Apps Script of a new Google Sheet,
 * then Deploy → New deployment → Web app (see README.md).
 *
 * The app sends all its recipes; this script merges them with the
 * Sheet ("last change wins" per recipe) and sends the merged list back.
 */

const SHEET_NAME = "Recipes";
const HEADERS = ["id", "title", "text", "tags", "notes", "updatedAt", "deleted"];
// Deleted recipes are kept as small markers so the deletion reaches
// every phone. After this many days the markers are removed.
const DELETED_KEEP_DAYS = 90;

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const request = JSON.parse(e.postData.contents);
    const sheet = getSheet_();
    let recipes = readRecipes_(sheet);

    if (request.action === "sync") {
      recipes = merge_(recipes, request.recipes || []);
      recipes = dropOldDeleted_(recipes);
      writeRecipes_(sheet, recipes);
    }
    return json_({ ok: true, recipes: recipes });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  } finally {
    lock.releaseLock();
  }
}

// Opening the link in a browser shows the recipes as JSON (a quick check).
function doGet() {
  return json_({ ok: true, app: "kitchen", recipes: readRecipes_(getSheet_()) });
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readRecipes_(sheet) {
  const rowCount = sheet.getLastRow() - 1;
  if (rowCount < 1) {
    return [];
  }
  const rows = sheet.getRange(2, 1, rowCount, HEADERS.length).getValues();
  return rows
    .filter(function (row) { return row[0]; })
    .map(function (row) {
      return {
        id: String(row[0]),
        title: String(row[1]),
        text: String(row[2]),
        tags: String(row[3]).split(",").map(function (t) { return t.trim(); }).filter(String),
        notes: String(row[4]),
        updatedAt: Number(row[5]) || 0,
        deleted: row[6] === true || String(row[6]).toUpperCase() === "TRUE",
      };
    });
}

function writeRecipes_(sheet, recipes) {
  const oldRows = sheet.getLastRow() - 1;
  if (oldRows > 0) {
    sheet.getRange(2, 1, oldRows, HEADERS.length).clearContent();
  }
  if (!recipes.length) {
    return;
  }
  const rows = recipes.map(function (r) {
    return [r.id, r.title, r.text, (r.tags || []).join(", "), r.notes, r.updatedAt, r.deleted ? "TRUE" : "FALSE"];
  });
  const range = sheet.getRange(2, 1, rows.length, HEADERS.length);
  // Plain text, so a recipe line starting with "=" is never read as a formula.
  range.setNumberFormat("@");
  range.setValues(rows);
}

function merge_(stored, incoming) {
  const byId = {};
  stored.concat(incoming).forEach(function (r) {
    if (!r || !r.id) {
      return;
    }
    const existing = byId[r.id];
    if (!existing || Number(r.updatedAt) > Number(existing.updatedAt)) {
      byId[r.id] = {
        id: String(r.id),
        title: String(r.title || ""),
        text: String(r.text || ""),
        tags: Array.isArray(r.tags) ? r.tags : [],
        notes: String(r.notes || ""),
        updatedAt: Number(r.updatedAt) || 0,
        deleted: r.deleted === true,
      };
    }
  });
  return Object.keys(byId).map(function (id) { return byId[id]; });
}

function dropOldDeleted_(recipes) {
  const cutoff = Date.now() - DELETED_KEEP_DAYS * 24 * 60 * 60 * 1000;
  return recipes.filter(function (r) {
    return !r.deleted || r.updatedAt > cutoff;
  });
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
