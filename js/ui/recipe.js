// Shows one recipe, ready to cook from: ratings, notes, a servings
// stepper and the recipe text with amounts scaled to the servings.
import * as state from "../state.js";
import * as shopping from "../shoppingState.js";
import { ingredientLines } from "../lib/sections.js";
import { bodyWithoutTitle, cookedNote, canEdit } from "../lib/recipes.js";
import { renderMarkdown } from "../lib/markdown.js";
import { formatAmount, stepServings } from "../lib/scale.js";
import { renderRating } from "./rating.js";
import { renderJump } from "./recipeJump.js";
import { nextRecipeId } from "./recipeQueue.js";
import { slideInNext } from "./tabs.js";
import { go, goBack } from "./router.js";
import { getMyName } from "./name.js";
import { showToast } from "./toast.js";

const title = document.getElementById("recipe-title");
const tags = document.getElementById("recipe-tags");
const notesBox = document.getElementById("recipe-notes-box");
const notes = document.getElementById("recipe-notes");
const body = document.getElementById("recipe-body");
const editLink = document.getElementById("edit-link");
const copyLink = document.getElementById("copy-link");
const ownerLine = document.getElementById("recipe-owner");
const cookedButton = document.getElementById("cooked-today");
const servingsDown = document.getElementById("servings-down");
const servingsUp = document.getElementById("servings-up");
const servingsLabel = document.getElementById("servings-label");
const servingsReset = document.getElementById("servings-reset");
const addToListButton = document.getElementById("add-to-list");
const addedDialog = document.getElementById("added-dialog");
const addedTitle = document.getElementById("added-title");
const addedText = document.getElementById("added-text");

let currentId = null;
// The servings shown. Without a known base it's a multiplier (1 = as written).
let shownServings = 1;
let shownBase = null;

// How much the shown servings differ from the recipe as written.
function shownFactor(recipe) {
  return recipe.servings ? shownServings / recipe.servings : shownServings;
}

function renderServingsAndBody(recipe) {
  const base = recipe.servings;
  const factor = shownFactor(recipe);

  if (base) {
    servingsLabel.textContent = shownServings + (shownServings === 1 ? " serving" : " servings");
  } else {
    servingsLabel.textContent = factor === 1 ? "As written" : "× " + formatAmount(factor);
  }
  servingsDown.disabled = base ? shownServings <= 1 : shownServings <= 0.5;
  servingsReset.hidden = factor === 1;

  // renderMarkdown escapes all HTML, so this is safe.
  body.innerHTML = renderMarkdown(bodyWithoutTitle(recipe.text, recipe.title), { scale: factor });
  renderJump(body);
}

// Returns false if the recipe doesn't exist (e.g. deleted on the other phone).
export function renderRecipe(id) {
  const recipe = state.getRecipe(id);
  if (!recipe) {
    return false;
  }
  // A different recipe, or its servings were edited: start as written.
  if (id !== currentId || recipe.servings !== shownBase) {
    shownServings = recipe.servings || 1;
    shownBase = recipe.servings;
  }
  currentId = id;
  document.title = recipe.title + " · Kitchen";
  title.textContent = recipe.title;

  tags.replaceChildren();
  for (const tag of recipe.tags) {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = tag;
    tags.appendChild(chip);
  }

  renderRating(recipe);

  notesBox.hidden = !recipe.notes;
  notes.textContent = recipe.notes;

  renderOwner(recipe);
  renderServingsAndBody(recipe);
  return true;
}

// "Added by Kadi · copy of Miso Aubergine (Tõnis)", and which buttons
// you get: the owner can edit; everyone can rate and make a copy.
function renderOwner(recipe) {
  ownerLine.replaceChildren();
  if (recipe.owner) {
    ownerLine.append("Added by " + recipe.owner);
  }
  const original = recipe.copyOf ? state.getRecipe(recipe.copyOf) : null;
  if (original) {
    ownerLine.append(recipe.owner ? " · copy of " : "Copy of ");
    const link = document.createElement("a");
    link.href = "#/r/" + encodeURIComponent(original.id);
    link.textContent = original.title;
    ownerLine.append(link);
    if (original.owner) {
      ownerLine.append(" (" + original.owner + ")");
    }
  }
  ownerLine.hidden = ownerLine.childNodes.length === 0;

  const mine = canEdit(recipe, getMyName());
  editLink.hidden = !mine;
  cookedButton.hidden = !mine;
  editLink.href = "#/r/" + encodeURIComponent(recipe.id) + "/edit";
  copyLink.href = "#/copy/" + encodeURIComponent(recipe.id);
}

export function canEditCurrent() {
  const recipe = state.getRecipe(currentId);
  return Boolean(recipe && canEdit(recipe, getMyName()));
}

// direction: +1 for more, -1 for fewer servings.
export function changeServings(direction) {
  const recipe = state.getRecipe(currentId);
  if (!recipe) {
    return;
  }
  shownServings = stepServings(shownServings, direction, Boolean(recipe.servings));
  renderServingsAndBody(recipe);
}

function addIngredients(recipe) {
  shopping.addRecipes([recipe], "add", shownFactor(recipe));
  showToast("Added to the shopping list", { label: "Open list", run: () => go("#/shopping") });
}

// Adds the ingredients, for the servings shown, to the current list.
// A second time would add the amounts up, so that has to be meant.
export function addCurrentToList() {
  const recipe = state.getRecipe(currentId);
  if (!recipe) {
    return;
  }
  if (ingredientLines(recipe.text).length === 0) {
    showToast("No ingredient list found in this recipe");
  } else if (shopping.hasRecipe(recipe.id)) {
    showToast("Already on the shopping list", { label: "Add again", run: () => addIngredients(recipe) });
  } else {
    addIngredients(recipe);
  }
}

// The next recipe in the list you came from. Replaces this one in the
// phone's history, so Back returns to the list however far you swiped.
export function showNextRecipe() {
  const next = nextRecipeId(currentId);
  if (!next) {
    showToast("That was the last recipe");
    goBack("#/");
    return;
  }
  slideInNext();
  go("#/r/" + encodeURIComponent(next), true);
}

function showAddedNotice(heading, text) {
  addedTitle.textContent = heading;
  addedText.textContent = text;
  addedDialog.returnValue = "";
  addedDialog.showModal();
}

// Adds the ingredients without asking; OK on the notice moves on. Already
// on the list: nothing is added, so a repeat doesn't double the amounts.
export function addAndContinue() {
  const recipe = state.getRecipe(currentId);
  if (!recipe) {
    return;
  }
  if (ingredientLines(recipe.text).length === 0) {
    showAddedNotice("Nothing added", "No ingredient list found in " + recipe.title + ".");
  } else if (shopping.hasRecipe(recipe.id)) {
    showAddedNotice("Already on the list", recipe.title + " is on the shopping list.");
  } else {
    shopping.addRecipes([recipe], "add", shownFactor(recipe));
    showAddedNotice("Added to the shopping list", servingsLabel.textContent === "As written" ? recipe.title : recipe.title + ", " + servingsLabel.textContent);
  }
}

// direction: +1 finger moved left (skip), -1 finger moved right (add).
export function swipeRecipe(direction) {
  if (direction > 0) {
    showNextRecipe();
  } else {
    addAndContinue();
  }
}

export function initRecipe() {
  addedDialog.addEventListener("close", function () {
    if (addedDialog.returnValue === "ok") {
      showNextRecipe();
    }
  });
  cookedButton.addEventListener("click", function () {
    if (!currentId) {
      return;
    }
    const note = cookedNote(new Date());
    state.addNote(currentId, note);
    renderRecipe(currentId);
    showToast("Added to notes: " + note);
  });

  addToListButton.addEventListener("click", addCurrentToList);
  servingsUp.addEventListener("click", () => changeServings(1));
  servingsDown.addEventListener("click", () => changeServings(-1));
  servingsReset.addEventListener("click", function () {
    const recipe = state.getRecipe(currentId);
    shownServings = (recipe && recipe.servings) || 1;
    renderServingsAndBody(recipe);
  });
}
