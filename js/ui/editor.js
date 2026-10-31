// The form for adding or editing a recipe.
import * as state from "../state.js";
import { titleFromText, parseTags, canEdit, copyForEditing } from "../lib/recipes.js";
import { detectServings } from "../lib/scale.js";
import { showToast } from "./toast.js";
import { go, goBack } from "./router.js";
import { getMyName, withMyName } from "./name.js";

const form = document.getElementById("edit-form");
const heading = document.getElementById("edit-heading");
const basedOn = document.getElementById("edit-based-on");
const textInput = document.getElementById("edit-text");
const titleInput = document.getElementById("edit-title");
const servingsInput = document.getElementById("edit-servings");
const tagsInput = document.getElementById("edit-tags");
const notesInput = document.getElementById("edit-notes");
const deleteButton = document.getElementById("delete-recipe");
const cancelButton = document.getElementById("cancel-edit");

let editingId = null;
// Id of the recipe being copied, when making your own copy.
let copyOf = "";
// True until the user types in the title / servings box themselves.
let titleIsAutomatic = true;
let servingsIsAutomatic = true;

// id = null for a new recipe; copyFrom = id of a recipe to start a copy from.
// Returns "ok", "missing" (no such recipe) or "locked" (someone else's).
export function openEditor(id, copyFrom) {
  const recipe = id ? state.getRecipe(id) : null;
  const source = copyFrom ? state.getRecipe(copyFrom) : null;
  if ((id && !recipe) || (copyFrom && !source)) {
    return "missing";
  }
  if (recipe && !canEdit(recipe, getMyName())) {
    return "locked";
  }
  editingId = id;
  copyOf = source ? source.id : "";
  heading.textContent = recipe ? "Edit recipe" : source ? "Make your copy" : "Add recipe";
  document.title = heading.textContent + " · Kitchen";
  basedOn.hidden = !source;
  if (source) {
    basedOn.textContent =
      "Based on \"" + source.title + "\"" + (source.owner ? " by " + source.owner : "") +
      ". Change anything you like: it's saved as your own recipe, and the original stays as it is.";
  }
  const start = recipe || (source ? copyForEditing(source) : null);
  textInput.value = start ? start.text : "";
  titleInput.value = start ? start.title : "";
  servingsInput.value = start && start.servings ? start.servings : "";
  servingsIsAutomatic = !servingsInput.value;
  tagsInput.value = start ? start.tags.join(", ") : "";
  notesInput.value = start ? start.notes : "";
  deleteButton.hidden = !recipe;
  titleIsAutomatic = !start;
  textInput.focus();
  return "ok";
}

export function saveFromEditor() {
  if (!form.reportValidity()) {
    return;
  }
  // The recipe is marked with your name, so ask for it first if needed.
  withMyName(save);
}

function save(myName) {
  const id = state.saveRecipe({
    id: editingId,
    title: titleInput.value,
    text: textInput.value,
    tags: parseTags(tagsInput.value),
    notes: notesInput.value,
    servings: Number(servingsInput.value) || null,
    owner: myName,
    copyOf: copyOf,
  });
  showToast(copyOf ? "Saved as your own copy" : "Recipe saved");
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
