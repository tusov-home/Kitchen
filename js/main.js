// Starts the app and wires the modules together.
import { APP_VERSION } from "./version.js";
import * as state from "./state.js";
import * as sync from "./sync.js";
import { parseRoute, trackHistory, go, goBack } from "./ui/router.js";
import { initList, renderList, focusSearch } from "./ui/list.js";
import { initRecipe, renderRecipe, changeServings, canEditCurrent } from "./ui/recipe.js";
import { showToast } from "./ui/toast.js";
import { rate } from "./ui/rating.js";
import { initName } from "./ui/name.js";
import { initEditor, openEditor, saveFromEditor, cancelEditor } from "./ui/editor.js";
import { initSettings, setSettingsStatus } from "./ui/settings.js";
import { initShortcuts } from "./ui/shortcuts.js";
import { initPwa, onInstallAvailable, install } from "./pwa.js";
import * as shoppingState from "./shoppingState.js";
import { initPlan, isPlanning, setPlanning } from "./ui/plan.js";
import { initShopping, renderShopping, renderCartCount } from "./ui/shopping.js";
import { initTabs, renderTabs, goToTab, stepTab } from "./ui/tabs.js";
import { pantry } from "./pantryState.js";
import { chores } from "./choresState.js";
import { initPantry, renderPantry, renderPantryBadge, focusPantryAdd } from "./ui/pantry.js";
import { initChores, renderChores, renderChoresBadge, openChore } from "./ui/chores.js";

const views = {
  list: document.getElementById("view-list"),
  recipe: document.getElementById("view-recipe"),
  edit: document.getElementById("view-edit"),
  shopping: document.getElementById("view-shopping"),
  pantry: document.getElementById("view-pantry"),
  chores: document.getElementById("view-chores"),
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
    const result = openEditor(current.id, current.copyFrom);
    if (result === "locked") {
      // Someone else's recipe: show it instead of the edit form.
      showToast("Only the owner can edit this — make your own copy instead");
      go("#/r/" + encodeURIComponent(current.id), true);
      return;
    }
    if (result !== "ok") {
      go("#/", true);
      return;
    }
  } else if (current.screen === "shopping") {
    setPlanning(false);
    renderShopping();
  } else if (current.screen === "pantry") {
    setPlanning(false);
    renderPantry();
  } else if (current.screen === "chores") {
    setPlanning(false);
    renderChores();
  } else {
    document.title = "Kitchen";
    renderList();
  }
  renderTabs(current.screen, views[current.screen]);
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

// The shopping list can change on the other phone too.
shoppingState.onChange(function () {
  renderCartCount();
  if (current.screen === "shopping") {
    renderShopping();
  }
});

// Pantry and chores can change on the other phone too.
pantry.onChange(function () {
  renderPantryBadge();
  if (current.screen === "pantry") {
    renderPantry();
  } else if (current.screen === "shopping") {
    renderShopping();
  }
});
chores.onChange(function () {
  renderChoresBadge();
  if (current.screen === "chores") {
    renderChores();
  }
});
// Back on the app after a while (maybe a new day): chores' due dates
// and the badge depend on today's date.
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") {
    renderChoresBadge();
    if (current.screen === "chores") {
      renderChores();
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
initName();
initEditor();
initSettings();
initPlan(renderList);
initShopping();
initPantry();
initChores();
initTabs(() => current.screen);
renderCartCount();
renderPantryBadge();
renderChoresBadge();

initShortcuts(
  {
    addRecipe: () => go("#/new"),
    focusSearch: focusSearch,
    editRecipe: function () {
      if (canEditCurrent()) {
        go("#/r/" + encodeURIComponent(current.id) + "/edit");
      } else {
        showToast("Only the owner can edit this — press C to make your copy");
      }
    },
    copyRecipe: () => go("#/copy/" + encodeURIComponent(current.id)),
    rate1: () => rate(1),
    rate2: () => rate(2),
    rate3: () => rate(3),
    rate4: () => rate(4),
    rate5: () => rate(5),
    moreServings: () => changeServings(1),
    fewerServings: () => changeServings(-1),
    save: saveFromEditor,
    back: function () {
      if (current.screen === "list" && isPlanning()) {
        setPlanning(false);
      } else if (current.screen === "edit") {
        cancelEditor();
      } else if (current.screen !== "list") {
        goBack("#/");
      }
    },
    openShopping: () => goToTab("shopping"),
    previousTab: () => stepTab(-1),
    nextTab: () => stepTab(1),
    focusPantryAdd: focusPantryAdd,
    addChore: () => openChore(null),
    togglePlanning: () => setPlanning(!isPlanning()),
    showHelp: () => document.getElementById("shortcut-help").showModal(),
  },
  () => current.screen
);

document.getElementById("app-version").textContent = "Version " + APP_VERSION;
// Just the letter next to the title, e.g. "Kitchen b".
document.getElementById("brand-version").textContent = APP_VERSION.split(" ").pop();

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
