// The settings page (the last page, after Projects): your name, sync link,
// backup export/import, privacy.
import * as state from "../state.js";
import * as storage from "../storage.js";
import * as sync from "../sync.js";
import { showToast } from "./toast.js";
import { getMyName, setMyName } from "./name.js";

const urlInput = document.getElementById("sync-url");
const saveButton = document.getElementById("sync-save");
const syncNowButton = document.getElementById("sync-now");
const statusText = document.getElementById("settings-sync-status");
const exportButton = document.getElementById("export-file");
const importInput = document.getElementById("import-file");
const nameInput = document.getElementById("my-name");

// Fills in the page each time it's shown.
export function renderSettings() {
  document.title = "Settings · Kitchen";
  urlInput.value = storage.loadSettings().syncUrl;
  nameInput.value = getMyName();
}

export function setSettingsStatus(message) {
  statusText.textContent = message;
}

export function initSettings() {
  // Saved as soon as you leave the box; refresh shows the new name.
  nameInput.addEventListener("change", function () {
    setMyName(nameInput.value);
    window.dispatchEvent(new Event("hashchange"));
  });

  saveButton.addEventListener("click", function () {
    const url = urlInput.value.trim();
    if (url && !/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) {
      setSettingsStatus("That doesn't look like an Apps Script web app link (it should end with /exec).");
      return;
    }
    storage.saveSettings(Object.assign(storage.loadSettings(), { syncUrl: url }));
    sync.syncNow();
  });

  syncNowButton.addEventListener("click", sync.syncNow);

  exportButton.addEventListener("click", function () {
    storage.exportToFile(state.getRecipes());
  });

  importInput.addEventListener("change", async function () {
    const file = importInput.files[0];
    if (!file) {
      return;
    }
    try {
      const recipes = await storage.importFromFile(file);
      state.mergeIn(recipes);
      showToast("Imported " + recipes.length + " recipes");
    } catch (error) {
      showToast("Could not import: " + error.message);
    }
    importInput.value = "";
  });
}
