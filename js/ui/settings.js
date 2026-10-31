// The settings dialog: sync link, backup export/import, privacy.
import * as state from "../state.js";
import * as storage from "../storage.js";
import * as sync from "../sync.js";
import { showToast } from "./toast.js";

const dialog = document.getElementById("settings");
const openButton = document.getElementById("open-settings");
const urlInput = document.getElementById("sync-url");
const saveButton = document.getElementById("sync-save");
const syncNowButton = document.getElementById("sync-now");
const statusText = document.getElementById("settings-sync-status");
const exportButton = document.getElementById("export-file");
const importInput = document.getElementById("import-file");

export function openSettings() {
  urlInput.value = storage.loadSettings().syncUrl;
  dialog.showModal();
}

export function setSettingsStatus(message) {
  statusText.textContent = message;
}

export function initSettings() {
  openButton.addEventListener("click", openSettings);

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
