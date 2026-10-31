// Shows one recipe, ready to cook from.
import * as state from "../state.js";
import { bodyWithoutTitle, cookedNote } from "../lib/recipes.js";
import { renderMarkdown } from "../lib/markdown.js";
import { showToast } from "./toast.js";

const title = document.getElementById("recipe-title");
const tags = document.getElementById("recipe-tags");
const notesBox = document.getElementById("recipe-notes-box");
const notes = document.getElementById("recipe-notes");
const body = document.getElementById("recipe-body");
const editLink = document.getElementById("edit-link");
const cookedButton = document.getElementById("cooked-today");

let currentId = null;

// Returns false if the recipe doesn't exist (e.g. deleted on the other phone).
export function renderRecipe(id) {
  const recipe = state.getRecipe(id);
  if (!recipe) {
    return false;
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

  notesBox.hidden = !recipe.notes;
  notes.textContent = recipe.notes;

  // renderMarkdown escapes all HTML, so this is safe.
  body.innerHTML = renderMarkdown(bodyWithoutTitle(recipe.text, recipe.title));
  editLink.href = "#/r/" + encodeURIComponent(id) + "/edit";
  return true;
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
}
