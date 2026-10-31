// Syncs recipes with the Google Sheet through its Apps Script web app.
// The app always works from the device's own copy; syncing happens in
// the background whenever there is a connection.
import * as state from "./state.js";
import * as storage from "./storage.js";
import { normaliseRecipe } from "./lib/recipes.js";

const DELAY_AFTER_CHANGE_MS = 1500;

let running = false;
let again = false;
let timer = null;
let statusListener = function () {};

// status: { state: "off" | "syncing" | "ok" | "offline" | "error", message }
export function onStatus(listener) {
  statusListener = listener;
}

function report(stateName, message) {
  statusListener({ state: stateName, message: message || "" });
}

export function isConfigured() {
  return Boolean(storage.loadSettings().syncUrl);
}

// Sends our recipes, gets back the merged list from the Sheet.
async function talkToSheet(url, recipes) {
  // text/plain avoids the browser's extra "preflight" request,
  // which Apps Script does not answer.
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "sync", recipes: recipes }),
  });
  if (!response.ok) {
    throw new Error("The Sheet answered with error " + response.status);
  }
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || "The Sheet reported a problem");
  }
  return data.recipes.map(normaliseRecipe).filter(Boolean);
}

export async function syncNow() {
  const settings = storage.loadSettings();
  if (!settings.syncUrl) {
    report("off", "Sync not set up");
    return;
  }
  if (!navigator.onLine) {
    report("offline", "Offline: changes are saved and will sync later");
    return;
  }
  // If a sync is already running, run once more after it.
  if (running) {
    again = true;
    return;
  }

  running = true;
  report("syncing", "Syncing…");
  try {
    const fromSheet = await talkToSheet(settings.syncUrl, state.getAllForSync());
    state.mergeIn(fromSheet, true);
    const now = Date.now();
    storage.saveSettings(Object.assign(storage.loadSettings(), { lastSync: now }));
    report("ok", "Synced " + new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
  } catch (error) {
    console.warn("Sync failed", error);
    report("error", "Sync failed: " + error.message);
  } finally {
    running = false;
    if (again) {
      again = false;
      syncNow();
    }
  }
}

// Waits a moment after a change, so several quick edits sync once.
export function syncSoon() {
  clearTimeout(timer);
  timer = setTimeout(syncNow, DELAY_AFTER_CHANGE_MS);
}

export function startAutoSync() {
  state.onChange(function (change) {
    if (!change.fromSync) {
      syncSoon();
    }
  });
  window.addEventListener("online", syncNow);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      syncNow();
    }
  });
  syncNow();
}
