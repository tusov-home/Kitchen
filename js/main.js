// Starts the app and wires the modules together.
import { APP_VERSION } from "./version.js";
import * as state from "./state.js";
import * as sync from "./sync.js";
import { parseRoute, trackHistory, go, goBack, stillClosing, getDepth, closeTo, closeToList } from "./ui/router.js";
import { toggleSuggestionOwner } from "./ui/suggestion.js";
import { initList, renderList, focusSearch, toggleFilters, openFilters, setBrowse, getBrowse, getSearch, clearSearch } from "./ui/list.js";
import { initRecipe, renderRecipe, canEditCurrent, swipeRecipe, showNextRecipe, addAndContinue, togglePlan } from "./ui/recipe.js";
import { showToast } from "./ui/toast.js";
import { initPlan, renderPlan } from "./ui/plan.js";
import { plans } from "./planState.js";
import { initRecipeJump, jumpTo } from "./ui/recipeJump.js";
import { initHaptics } from "./ui/haptics.js";
import { initAsk } from "./ui/ask.js";
import { initName } from "./ui/name.js";
import { initEditor, openEditor, saveFromEditor, cancelEditor } from "./ui/editor.js";
import { initSettings, setSettingsStatus, renderSettings } from "./ui/settings.js";
import { keepScreenOn } from "./ui/screenAwake.js";
import { initTimers, dismissAlarms } from "./ui/timers.js";
import { initShortcuts } from "./ui/shortcuts.js";
import { initPwa, onInstallAvailable, install } from "./pwa.js";
import * as shoppingState from "./shoppingState.js";
import { initShopping, renderShopping, renderCartCount } from "./ui/shopping.js";
import { initTabs, renderTabs, goToTab, stepTab, onRecipeSwipe, closeRecipeSheet, isSheet } from "./ui/tabs.js";
import { pantry, pantrySections } from "./pantryState.js";
import { initPantry, renderPantry, renderPantryBadge, focusPantryAdd } from "./ui/pantry.js";
import { initPantrySections, openSections } from "./ui/pantrySections.js";
import { projects } from "./projectsState.js";
import { initProjects, renderProjects, openProjectDialog } from "./ui/projects.js";
import { initProject, renderProject, editCurrentProject } from "./ui/project.js";

const views = {
  list: document.getElementById("view-list"),
  recipe: document.getElementById("view-recipe"),
  edit: document.getElementById("view-edit"),
  shopping: document.getElementById("view-shopping"),
  pantry: document.getElementById("view-pantry"),
  projects: document.getElementById("view-projects"),
  project: document.getElementById("view-project"),
  plan: document.getElementById("view-plan"),
  browse: document.getElementById("view-browse"),
  settings: document.getElementById("view-settings"),
};
const searchInput = document.getElementById("search");
const brand = document.getElementById("brand");
const brandMark = document.getElementById("brand-mark");

let current = { screen: "list", id: null };

// The sheet a recipe was opened from (a list or the plan), which closing
// the recipe returns to: { screen, hash, depth } or null.
let under = null;

const BROWSE_HASH = { meal: "#/meals", sauce: "#/sauces", search: "#/search" };

function showView(screen) {
  for (const name in views) {
    views[name].hidden = name !== screen;
  }
  // Sheets lie on top of the recipes page, which stays underneath; a recipe
  // can also lie on the sheet it was opened from.
  if (screen === "project") {
    views.projects.hidden = false;
  } else if (isSheet(screen)) {
    views.list.hidden = false;
  }
  if (screen === "recipe" && under) {
    views[under.screen].hidden = false;
  }
}

// Remembers which sheet lies under a recipe, as it opens.
function trackUnder(cameFrom) {
  if (cameFrom === "plan" || cameFrom === "browse") {
    under = { screen: cameFrom, hash: cameFrom === "plan" ? "#/plan" : BROWSE_HASH[getBrowse()], depth: getDepth() - 1 };
  } else if (cameFrom !== "recipe" && cameFrom !== "edit") {
    under = null;
  }
}

// Closes the top sheet: a recipe goes back to the sheet under it, anything
// else back to the recipes page.
function closeSheet() {
  if (current.screen === "recipe" && under) {
    closeTo(under.depth, under.screen, under.hash);
  } else if (current.screen === "project") {
    closeTo(getDepth() - 1, "projects", "#/projects");
  } else {
    closeToList();
  }
}

function sheetLandsHome() {
  return !(current.screen === "recipe" && under);
}

// Typing in the search box opens the results sheet; emptying it closes it.
function onSearch(text) {
  if (text && current.screen === "list") {
    go("#/search");
  } else if (!text && current.screen === "browse" && getBrowse() === "search") {
    closeToList();
  }
}

// A / S: open meals or sauces; pressed again, close them.
function toggleKind(kind) {
  if (current.screen === "browse" && getBrowse() === kind) {
    closeRecipeSheet();
  } else {
    go(BROWSE_HASH[kind], current.screen === "browse");
  }
}

// F: on the recipes page, open meals with the filters showing.
function filterKey() {
  if (current.screen === "browse") {
    toggleFilters();
  } else {
    openFilters();
    go("#/meals");
  }
}

// Shows the screen that matches the address.
function route() {
  trackHistory();
  const cameFrom = current.screen;
  current = parseRoute(location.hash);
  if (stillClosing(current.screen)) {
    return;
  }
  if (current.screen !== "recipe" && current.screen !== "edit") {
    under = null;
  }
  // Leave the previous screen's text box, so shortcuts work again; but the
  // search box stays in use while its results open.
  const keepSearch = document.activeElement === searchInput && current.screen === "browse";
  if (document.activeElement && document.activeElement !== document.body && !keepSearch) {
    document.activeElement.blur();
  }
  // Show first, so the editor can put the cursor in the text box.
  showView(current.screen);

  if (current.screen === "recipe") {
    if (!renderRecipe(current.id)) {
      go("#/", true); // recipe no longer exists
      return;
    }
    trackUnder(cameFrom);
    showView("recipe");
    // It's already drawn under the sheet, unless the app started here.
    if (!isSheet(cameFrom) && cameFrom !== "list") {
      renderList();
    }
    views.recipe.scrollTop = 0;
    if (cameFrom !== "recipe") {
      playSheetOpening(views.recipe, !isSheet(cameFrom));
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
  } else if (current.screen === "plan") {
    renderPlan();
    if (!isSheet(cameFrom) && cameFrom !== "list") {
      renderList();
    }
    if (cameFrom !== "plan") {
      views.plan.scrollTop = 0;
    }
    // Back from a recipe, the plan is already there under it.
    if (cameFrom !== "plan" && cameFrom !== "recipe") {
      playSheetOpening(views.plan, true);
    }
  } else if (current.screen === "browse") {
    const switching = cameFrom === "browse" && getBrowse() !== current.id;
    setBrowse(current.id);
    renderList();
    if (cameFrom !== "browse" || switching) {
      if (cameFrom !== "recipe") {
        views.browse.scrollTop = 0;
      }
    }
    if (cameFrom !== "browse" && cameFrom !== "recipe") {
      playSheetOpening(views.browse, true);
    }
  } else if (current.screen === "shopping") {
    renderShopping();
  } else if (current.screen === "pantry") {
    renderPantry();
  } else if (current.screen === "projects") {
    // Under a closing project it's already drawn, and a redraw would stutter.
    if (cameFrom !== "project") {
      renderProjects();
    }
  } else if (current.screen === "settings") {
    renderSettings();
  } else if (current.screen === "project") {
    if (!renderProject(current.id)) {
      go("#/projects", true); // project no longer exists
      return;
    }
    if (cameFrom !== "projects") {
      renderProjects();
    }
    views.project.scrollTop = 0;
    playSheetOpening(views.project, true);
  } else {
    document.title = "Kitchen";
    // Back on the recipes page, the search starts empty again.
    if (getSearch()) {
      clearSearch();
    }
    // Under a closing sheet it's already drawn, and a redraw would stutter.
    if (!isSheet(cameFrom)) {
      renderList();
    }
  }
  renderTabs(current.screen, views[current.screen]);
  keepScreenOn("recipe", current.screen === "recipe");
  // The page under a sheet stays where you left it.
  const backUnder = (current.screen === "list" && isSheet(cameFrom)) || (current.screen === "projects" && cameFrom === "project");
  if (!isSheet(current.screen) && !backUnder) {
    window.scrollTo(0, 0);
  }
}

// The sheet rises from below; the shade behind it fades in only when it
// opens over the recipes page (not over another sheet).
function playSheetOpening(view, shade) {
  view.classList.add("sheet-opening");
  if (shade) {
    document.body.classList.add("shade-in");
  }
  setTimeout(function () {
    view.classList.remove("sheet-opening");
    document.body.classList.remove("shade-in");
  }, 380);
}

// When recipes change (also from the other phone), refresh what's shown.
// The edit form is left alone, so nobody loses what they're typing.
state.onChange(function () {
  if (current.screen === "plan") {
    renderPlan();
    renderList();
  } else if (current.screen === "list" || current.screen === "browse") {
    renderList();
  } else if (current.screen === "recipe") {
    renderList();
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

// The pantry can change on the other phone too.
pantry.onChange(function () {
  renderPantryBadge();
  if (current.screen === "pantry") {
    renderPantry();
  } else if (current.screen === "browse") {
    renderList(); // the pantry part of a search
  } else if (current.screen === "shopping") {
    renderShopping();
  }
});
// The plan can change on the other phone too.
plans.onChange(function () {
  if (current.screen === "plan") {
    renderPlan();
    renderList(); // the page under the sheet shows the plan row
  } else if (current.screen === "list" || current.screen === "browse") {
    renderList();
  } else if (current.screen === "recipe") {
    renderRecipe(current.id); // the amounts follow the planned servings
    renderList(); // the page under the sheet shows the plan row
    if (under && under.screen === "plan") {
      renderPlan();
    }
  }
});
pantrySections.onChange(function () {
  if (current.screen === "pantry") {
    renderPantry();
  }
});
projects.onChange(function () {
  if (current.screen === "projects") {
    renderProjects();
  } else if (current.screen === "project") {
    renderProjects(); // the page under the sheet
    if (!renderProject(current.id)) {
      go("#/projects", true);
    }
  }
});
// "On the shopping list" notes on a project follow the shopping list.
shoppingState.onChange(function () {
  if (current.screen === "project") {
    renderProject(current.id);
  }
});

sync.onStatus(function (status) {
  // The ensō shows it: turning while syncing, green when up to date.
  brandMark.dataset.state = status.state;
  brand.title = status.message;
  setSettingsStatus(status.message);
});

document.getElementById("add-recipe").addEventListener("click", function () {
  go("#/new");
});

initList(onSearch);
initTimers();
initHaptics();
initAsk();
initRecipe();
document.getElementById("recipe-backdrop").addEventListener("click", closeRecipeSheet);
onRecipeSwipe(swipeRecipe);
initPlan();
initRecipeJump();
initName();
initEditor();
initSettings();
initShopping();
initPantry();
initPantrySections();
initProjects();
initProject();
initTabs(() => current.screen, { close: closeSheet, landsHome: sheetLandsHome });
renderCartCount();
renderPantryBadge();

initShortcuts(
  {
    addRecipe: () => go("#/new"),
    focusSearch: focusSearch,
    toggleMeals: () => toggleKind("meal"),
    toggleSauces: () => toggleKind("sauce"),
    toggleFilters: filterKey,
    dismissAlarms: dismissAlarms,
    suggestT: () => toggleSuggestionOwner("T"),
    suggestK: () => toggleSuggestionOwner("K"),
    editRecipe: function () {
      if (canEditCurrent()) {
        go("#/r/" + encodeURIComponent(current.id) + "/edit");
      } else {
        showToast("Only the owner can edit this — press C to make your copy");
      }
    },
    copyRecipe: () => go("#/copy/" + encodeURIComponent(current.id)),
    jumpIngredients: () => jumpTo("Ingredients"),
    jumpMethod: () => jumpTo("Method"),
    nextRecipe: showNextRecipe,
    addAndNext: addAndContinue,
    togglePlan: togglePlan,
    openPlan: () => go("#/plan"),
    save: saveFromEditor,
    back: function () {
      if (current.screen === "edit") {
        cancelEditor();
      } else if (isSheet(current.screen)) {
        closeRecipeSheet();
      } else if (current.screen !== "list") {
        goBack("#/");
      }
    },
    openShopping: () => goToTab("shopping"),
    previousTab: () => stepTab(-1),
    nextTab: () => stepTab(1),
    focusPantryAdd: focusPantryAdd,
    openSections: openSections,
    addProject: () => openProjectDialog(null),
    editProject: editCurrentProject,
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
