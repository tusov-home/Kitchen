// Shows one recipe, ready to cook from: ratings, notes, a servings
// stepper and the recipe text with amounts scaled to the servings.
import * as state from "../state.js";
import { bodyWithoutTitle, cookedNote } from "../lib/recipes.js";
import { renderMarkdown } from "../lib/markdown.js";
import { formatAmount, stepServings } from "../lib/scale.js";
import { renderRating } from "./rating.js";
import { showToast } from "./toast.js";

const title = document.getElementById("recipe-title");
const tags = document.getElementById("recipe-tags");
const notesBox = document.getElementById("recipe-notes-box");
const notes = document.getElementById("recipe-notes");
const body = document.getElementById("recipe-body");
const editLink = document.getElementById("edit-link");
const cookedButton = document.getElementById("cooked-today");
const servingsDown = document.getElementById("servings-down");
const servingsUp = document.getElementById("servings-up");
const servingsLabel = document.getElementById("servings-label");
const servingsReset = document.getElementById("servings-reset");

let currentId = null;
// The servings shown. Without a known base it's a multiplier (1 = as written).
let shownServings = 1;
let shownBase = null;

function renderServingsAndBody(recipe) {
  const base = recipe.servings;
  const factor = base ? shownServings / base : shownServings;

  if (base) {
    servingsLabel.textContent = shownServings + (shownServings === 1 ? " serving" : " servings");
  } else {
    servingsLabel.textContent = factor === 1 ? "As written" : "× " + formatAmount(factor);
  }
  servingsDown.disabled = base ? shownServings <= 1 : shownServings <= 0.5;
  servingsReset.hidden = factor === 1;

  // renderMarkdown escapes all HTML, so this is safe.
  body.innerHTML = renderMarkdown(bodyWithoutTitle(recipe.text, recipe.title), { scale: factor });
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

  renderServingsAndBody(recipe);
  editLink.href = "#/r/" + encodeURIComponent(id) + "/edit";
  return true;
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

export function initRecipe() {
  cookedButton.addEventListener("click", function () {
    if (!currentId) {
      return;
    }
    const note = cookedNote(new Date());
    state.addNote(currentId, note);
    renderRecipe(currentId);
    showToast("Added to notes: " + note);
  });

  servingsUp.addEventListener("click", () => changeServings(1));
  servingsDown.addEventListener("click", () => changeServings(-1));
  servingsReset.addEventListener("click", function () {
    const recipe = state.getRecipe(currentId);
    shownServings = (recipe && recipe.servings) || 1;
    renderServingsAndBody(recipe);
  });
}
