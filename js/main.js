// Starts the app and wires the modules together.
import { APP_VERSION } from "./version.js";
import * as state from "./state.js";
import * as sync from "./sync.js";
import { parseRoute, trackHistory, go, goBack } from "./ui/router.js";
import { initList, renderList, focusSearch } from "./ui/list.js";
import { initRecipe, renderRecipe, changeServings } from "./ui/recipe.js";
import { initRating, rate } from "./ui/rating.js";
import { initEditor, openEditor, saveFromEditor, cancelEditor } from "./ui/editor.js";
import { initSettings, setSettingsStatus } from "./ui/settings.js";
import { initShortcuts } from "./ui/shortcuts.js";
import { initPwa, onInstallAvailable, install } from "./pwa.js";

const views = {
  list: document.getElementById("view-list"),
  recipe: document.getElementById("view-recipe"),
  edit: document.getElementById("view-edit"),
};
const syncStatus = document.getElementById("sync-status");

let current = { screen: "list", id: null };

function showView(screen) {
  for (const name in views) {
    views[name].hidden = name !== screen;
  }
}

// Shows the screen that matches the address.
function route() {
  trackHistory();
  current = parseRoute(location.hash);
  // Leave the previous screen's text box, so shortcuts work again.
  if (document.activeElement && document.activeElement !== document.body) {
    document.activeElement.blur();
  }
  // Show first, so the editor can put the cursor in the text box.
  showView(current.screen);

  if (current.screen === "recipe") {
    if (!renderRecipe(current.id)) {
      go("#/", true); // recipe no longer exists
      return;
    }
  } else if (current.screen === "edit") {
    if (!openEditor(current.id)) {
      go("#/", true);
      return;
    }
  } else {
    document.title = "Kitchen";
    renderList();
  }
  window.scrollTo(0, 0);
}

// When recipes change (also from the other phone), refresh what's shown.
// The edit form is left alone, so nobody loses what they're typing.
state.onChange(function () {
  if (current.screen === "list") {
    renderList();
  } else if (current.screen === "recipe") {
    if (!renderRecipe(current.id)) {
      go("#/", true);
    }
  }
});

sync.onStatus(function (status) {
  syncStatus.dataset.state = status.state;
  syncStatus.title = status.message;
  syncStatus.textContent = status.state === "syncing" ? "↻" : "";
  setSettingsStatus(status.message);
});

document.getElementById("add-recipe").addEventListener("click", function () {
  go("#/new");
});

initList();
initRecipe();
initRating();
initEditor();
initSettings();

initShortcuts(
  {
    addRecipe: () => go("#/new"),
    focusSearch: focusSearch,
    editRecipe: () => go("#/r/" + encodeURIComponent(current.id) + "/edit"),
    rate1: () => rate(1),
    rate2: () => rate(2),
    rate3: () => rate(3),
    rate4: () => rate(4),
    rate5: () => rate(5),
    moreServings: () => changeServings(1),
    fewerServings: () => changeServings(-1),
    save: saveFromEditor,
    back: () => (current.screen === "edit" ? cancelEditor() : goBack("#/")),
    showHelp: () => document.getElementById("shortcut-help").showModal(),
  },
  () => current.screen
);

document.getElementById("app-version").textContent = "Version " + APP_VERSION;

// "Install app" button appears only when the browser allows installing.
const installButton = document.getElementById("install-app");
onInstallAvailable(function (available) {
  installButton.hidden = !available;
});
installButton.addEventListener("click", install);
initPwa();

window.addEventListener("hashchange", route);
route();
sync.startAutoSync();
