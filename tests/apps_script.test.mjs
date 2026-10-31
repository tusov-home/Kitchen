// Runs apps-script/Code.gs against a small fake Google Sheet.
// Run with: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");

// A tiny stand-in for one Google Sheet tab: a 2D array of cells.
function fakeSheet(rows) {
  let cells = rows.map((r) => r.slice());
  const sheet = {
    cells: () => cells,
    getLastRow: () => {
      let last = 0;
      cells.forEach((row, i) => { if (row.some((c) => c !== "")) last = i + 1; });
      return last;
    },
    getLastColumn: () => Math.max(0, ...cells.map((r) => {
      let last = 0;
      r.forEach((c, i) => { if (c !== "") last = i + 1; });
      return last;
    })),
    getRange: (row, col, numRows, numCols) => ({
      getValues: () => {
        const out = [];
        for (let r = 0; r < numRows; r++) {
          const line = [];
          for (let c = 0; c < numCols; c++) line.push((cells[row - 1 + r] || [])[col - 1 + c] ?? "");
          out.push(line);
        }
        return out;
      },
      setValues: (values) => {
        values.forEach((line, r) => {
          cells[row - 1 + r] = cells[row - 1 + r] || [];
          line.forEach((v, c) => { cells[row - 1 + r][col - 1 + c] = v; });
        });
        return { setFontWeight: () => {} };
      },
      clearContent: () => {
        for (let r = 0; r < numRows; r++) for (let c = 0; c < numCols; c++) {
          if (cells[row - 1 + r]) cells[row - 1 + r][col - 1 + c] = "";
        }
      },
      setNumberFormat: () => {},
    }),
    setFrozenRows: () => {},
  };
  return sheet;
}

function loadScript(sheets) {
  const SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
      getSheetByName: (name) => sheets[name] || null,
      insertSheet: (name) => (sheets[name] = fakeSheet([])),
    }),
  };
  const LockService = { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) };
  const ContentService = {
    MimeType: { JSON: "json" },
    createTextOutput: (text) => ({ setMimeType: () => JSON.parse(text) }),
  };
  return new Function("SpreadsheetApp", "LockService", "ContentService", SOURCE + "; return { doPost, doGet };")(
    SpreadsheetApp, LockService, ContentService
  );
}

function post(script, body) {
  return script.doPost({ postData: { contents: JSON.stringify(body) } });
}

test("converts an old-format Sheet and keeps every field", () => {
  const old = fakeSheet([
    ["id", "title", "text", "tags", "notes", "updatedAt", "deleted", "servings", "ratings", "owner", "copyOf"],
    ["r1", "Ragu", "Slow cook", "weekend, beef", "", "100", "FALSE", "4", '{"Kadi":{"stars":5,"at":7}}', "Kadi", ""],
  ]);
  const script = loadScript({ Recipes: old });
  const reply = post(script, { action: "sync", recipes: [] });
  assert.equal(reply.ok, true);
  const r = reply.recipes[0];
  assert.deepEqual(r.tags, ["weekend", "beef"]);
  assert.equal(r.servings, 4);
  assert.equal(r.owner, "Kadi");
  assert.deepEqual(r.ratings, { Kadi: { stars: 5, at: 7 } });
  // The Sheet is now in the new format, without leftover old columns
  assert.deepEqual(old.cells()[0].filter(Boolean), ["id", "title", "owner", "updatedAt", "deleted", "data"]);
  assert.equal(old.getLastColumn(), 6);
  // …and reads back the same
  assert.deepEqual(script.doGet().recipes, reply.recipes);
});

test("newest version wins, ratings merge person by person", () => {
  const script = loadScript({});
  post(script, { action: "sync", recipes: [
    { id: "a", title: "old", updatedAt: 1, ratings: { Kadi: { stars: 5, at: 9 } } },
  ] });
  const reply = post(script, { action: "sync", recipes: [
    { id: "a", title: "new", updatedAt: 2, ratings: { Tõnis: { stars: 3, at: 4 } } },
  ] });
  const r = reply.recipes[0];
  assert.equal(r.title, "new");
  assert.deepEqual(Object.keys(r.ratings).sort(), ["Kadi", "Tõnis"]);
});

test("unknown new fields are stored without changing the script", () => {
  const script = loadScript({});
  post(script, { action: "sync", recipes: [{ id: "x", updatedAt: 1, futureField: { deep: [1, 2] } }] });
  assert.deepEqual(script.doGet().recipes[0].futureField, { deep: [1, 2] });
});

test("other collections get their own tab", () => {
  const sheets = {};
  const script = loadScript(sheets);
  const reply = post(script, { action: "sync", collection: "mealplans", items: [{ id: "w1", updatedAt: 1 }] });
  assert.equal(reply.items.length, 1);
  assert.ok(sheets.mealplans);
  assert.equal(script.doGet().recipes.length, 0);
});

test("old deleted markers are cleaned up, recent ones kept", () => {
  const script = loadScript({});
  const now = Date.now();
  const reply = post(script, { action: "sync", recipes: [
    { id: "gone", deleted: true, updatedAt: now - 100 * 24 * 3600 * 1000 },
    { id: "recent", deleted: true, updatedAt: now },
  ] });
  assert.deepEqual(reply.recipes.map((r) => r.id), ["recent"]);
});
