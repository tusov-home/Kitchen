// Syncs recipes and the shopping list with the Google Sheet through its
// Apps Script web app.
// The app always works from the device's own copy; syncing happens in
// the background whenever there is a connection.
import * as state from "./state.js";
import * as shopping from "./shoppingState.js";
import { pantry } from "./pantryState.js";
import { chores } from "./choresState.js";
import { projects } from "./projectsState.js";
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

// Sends a request to the Sheet and returns its answer.
async function post(url, body) {
  // text/plain avoids the browser's extra "preflight" request,
  // which Apps Script does not answer.
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error("The Sheet answered with error " + response.status);
  }
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || "The Sheet reported a problem");
  }
  return data;
}

// Sends our recipes, gets back the merged list from the Sheet.
async function syncRecipes(url) {
  const data = await post(url, { action: "sync", recipes: state.getAllForSync() });
  state.mergeIn(data.recipes.map(normaliseRecipe).filter(Boolean), true);
}

// Everything else has its own tab in the Sheet. Each needs
// getAllForSync(), mergeIn(items, fromSync) and onChange(listener).
const COLLECTIONS = [
  { name: "shopping", store: shopping },
  { name: "pantry", store: pantry },
  { name: "chores", store: chores },
  { name: "projects", store: projects },
];

// Returns false if the Sheet's script is too old to know about collections.
async function syncCollection(url, collection) {
  const data = await post(url, { action: "sync", collection: collection.name, items: collection.store.getAllForSync() });
  // The old script ignores "collection" and answers without "items".
  if (!Array.isArray(data.items)) {
    return false;
  }
  collection.store.mergeIn(data.items, true);
  return true;
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
    await syncRecipes(settings.syncUrl);
    let allSynced = true;
    for (const collection of COLLECTIONS) {
      allSynced = (await syncCollection(settings.syncUrl, collection)) && allSynced;
      if (!allSynced) {
        break; // the old script won't know the others either
      }
    }
    const now = Date.now();
    storage.saveSettings(Object.assign(storage.loadSettings(), { lastSync: now }));
    const time = new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (allSynced) {
      report("ok", "Synced " + time);
    } else {
      report("error", "Recipes synced " + time + ", but shopping, pantry, chores and projects need the new Code.gs (see README)");
    }
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
  for (const collection of COLLECTIONS) {
    collection.store.onChange(function (change) {
      if (!change.fromSync) {
        syncSoon();
      }
    });
  }
  window.addEventListener("online", syncNow);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      syncNow();
    }
  });
  syncNow();
}
