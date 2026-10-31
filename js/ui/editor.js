// The form for adding or editing a recipe.
import * as state from "../state.js";
import { titleFromText, parseTags } from "../lib/recipes.js";
import { detectServings } from "../lib/scale.js";
import { showToast } from "./toast.js";
import { go, goBack } from "./router.js";

const form = document.getElementById("edit-form");
const heading = document.getElementById("edit-heading");
const textInput = document.getElementById("edit-text");
const titleInput = document.getElementById("edit-title");
const servingsInput = document.getElementById("edit-servings");
const tagsInput = document.getElementById("edit-tags");
const notesInput = document.getElementById("edit-notes");
const deleteButton = document.getElementById("delete-recipe");
const cancelButton = document.getElementById("cancel-edit");

let editingId = null;
// True until the user types in the title / servings box themselves.
let titleIsAutomatic = true;
let servingsIsAutomatic = true;

// id = null for a new recipe. Returns false if the recipe doesn't exist.
export function openEditor(id) {
  const recipe = id ? state.getRecipe(id) : null;
  if (id && !recipe) {
    return false;
  }
  editingId = id;
  heading.textContent = recipe ? "Edit recipe" : "Add recipe";
  document.title = heading.textContent + " · Kitchen";
  textInput.value = recipe ? recipe.text : "";
  titleInput.value = recipe ? recipe.title : "";
  servingsInput.value = recipe && recipe.servings ? recipe.servings : "";
  servingsIsAutomatic = !servingsInput.value;
  tagsInput.value = recipe ? recipe.tags.join(", ") : "";
  notesInput.value = recipe ? recipe.notes : "";
  deleteButton.hidden = !recipe;
  titleIsAutomatic = !recipe;
  textInput.focus();
  return true;
}

export function saveFromEditor() {
  if (!form.reportValidity()) {
    return;
  }
  const id = state.saveRecipe({
    id: editingId,
    title: titleInput.value,
    text: textInput.value,
    tags: parseTags(tagsInput.value),
    notes: notesInput.value,
    servings: Number(servingsInput.value) || null,
  });
  showToast("Recipe saved");
  if (editingId) {
    // Edited from the recipe screen: just step back to it.
    goBack("#/r/" + encodeURIComponent(id));
  } else {
    // New recipe: replace the form in the history, so Back goes to the list.
    go("#/r/" + encodeURIComponent(id), true);
  }
}

export function cancelEditor() {
  goBack(editingId ? "#/r/" + encodeURIComponent(editingId) : "#/");
}

export function initEditor() {
  // Fill in the title from the first line, unless the user wrote their own.
  textInput.addEventListener("input", function () {
    if (titleIsAutomatic) {
      titleInput.value = titleFromText(textInput.value);
    }
    if (servingsIsAutomatic) {
      servingsInput.value = detectServings(textInput.value) || "";
    }
  });
  titleInput.addEventListener("input", function () {
    titleIsAutomatic = titleInput.value === "";
  });
  servingsInput.addEventListener("input", function () {
    servingsIsAutomatic = servingsInput.value === "";
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    saveFromEditor();
  });
  cancelButton.addEventListener("click", cancelEditor);

  deleteButton.addEventListener("click", function () {
    if (!editingId || !confirm("Delete \"" + titleInput.value + "\"? This also removes it from the other phone.")) {
      return;
    }
    state.deleteRecipe(editingId);
    showToast("Recipe deleted");
    go("#/", true);
  });
}
