// Starts the app and wires the modules together.
import { APP_VERSION } from "./version.js";
import * as state from "./state.js";
import * as sync from "./sync.js";
import { parseRoute, trackHistory, go, goBack, stillClosing } from "./ui/router.js";
import { toggleSuggestionOwner } from "./ui/suggestion.js";
import { initList, renderList, focusSearch, toggleKind, toggleFilters } from "./ui/list.js";
import { initRecipe, renderRecipe, changeServings, canEditCurrent, swipeRecipe, showNextRecipe, addAndContinue, togglePlan, renderPlanToggle } from "./ui/recipe.js";
import { showToast } from "./ui/toast.js";
import { initPlan, renderPlan } from "./ui/plan.js";
import { plans } from "./planState.js";
import { initRecipeJump, jumpTo } from "./ui/recipeJump.js";
import { initHaptics } from "./ui/haptics.js";
import { initName } from "./ui/name.js";
import { initEditor, openEditor, saveFromEditor, cancelEditor } from "./ui/editor.js";
import { initSettings, setSettingsStatus } from "./ui/settings.js";
import { initShortcuts } from "./ui/shortcuts.js";
import { initPwa, onInstallAvailable, install } from "./pwa.js";
import * as shoppingState from "./shoppingState.js";
import { initShopping, renderShopping, renderCartCount } from "./ui/shopping.js";
import { initTabs, renderTabs, goToTab, stepTab, onRecipeSwipe, closeRecipeSheet } from "./ui/tabs.js";
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
};
const brand = document.getElementById("brand");
const brandMark = document.getElementById("brand-mark");

let current = { screen: "list", id: null };

function showView(screen) {
  for (const name in views) {
    views[name].hidden = name !== screen;
  }
  // A recipe is a sheet on top of the recipes page, which stays underneath.
  if (screen === "recipe") {
    views.list.hidden = false;
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
    // It's already drawn under the sheet, unless the app started here.
    if (cameFrom !== "list" && cameFrom !== "recipe") {
      renderList();
    }
    views.recipe.scrollTop = 0;
    if (cameFrom !== "recipe") {
      playSheetOpening();
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
  } else if (current.screen === "shopping") {
    renderShopping();
  } else if (current.screen === "pantry") {
    renderPantry();
  } else if (current.screen === "projects") {
    renderProjects();
  } else if (current.screen === "project") {
    if (!renderProject(current.id)) {
      go("#/projects", true); // project no longer exists
      return;
    }
  } else {
    document.title = "Kitchen";
    // Under a closing recipe it's already drawn, and a redraw would stutter.
    if (cameFrom !== "recipe") {
      renderList();
    }
  }
  renderTabs(current.screen, views[current.screen]);
  // The page under a recipe stays where you left it.
  if (current.screen !== "recipe" && !(current.screen === "list" && cameFrom === "recipe")) {
    window.scrollTo(0, 0);
  }
}

function playSheetOpening() {
  document.body.classList.add("sheet-opening");
  setTimeout(() => document.body.classList.remove("sheet-opening"), 380);
}

// When recipes change (also from the other phone), refresh what's shown.
// The edit form is left alone, so nobody loses what they're typing.
state.onChange(function () {
  if (current.screen === "plan") {
    renderPlan();
  } else if (current.screen === "list") {
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
  } else if (current.screen === "shopping") {
    renderShopping();
  }
});
// The plan can change on the other phone too.
plans.onChange(function () {
  if (current.screen === "plan") {
    renderPlan();
  } else if (current.screen === "list") {
    renderList();
  } else if (current.screen === "recipe") {
    renderPlanToggle();
    renderList(); // the page under the sheet shows the plan row
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

initList();
initHaptics();
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
initTabs(() => current.screen);
renderCartCount();
renderPantryBadge();

initShortcuts(
  {
    addRecipe: () => go("#/new"),
    focusSearch: focusSearch,
    toggleMeals: () => toggleKind("meal"),
    toggleSauces: () => toggleKind("sauce"),
    toggleFilters: toggleFilters,
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
    moreServings: () => changeServings(1),
    fewerServings: () => changeServings(-1),
    save: saveFromEditor,
    back: function () {
      if (current.screen === "edit") {
        cancelEditor();
      } else if (current.screen === "project") {
        document.getElementById("project-back").click();
      } else if (current.screen === "recipe") {
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
