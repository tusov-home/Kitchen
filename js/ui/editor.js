// The form for adding or editing a recipe.
import * as state from "../state.js";
import { titleFromText, parseTags, canEdit, copyForEditing, kindOf } from "../lib/recipes.js";
import { detectServings } from "../lib/scale.js";
import { showToast } from "./toast.js";
import { go, goBack } from "./router.js";
import { getMyName, withMyName } from "./name.js";
import { getOpenKind } from "./list.js";

const form = document.getElementById("edit-form");
const heading = document.getElementById("edit-heading");
const basedOn = document.getElementById("edit-based-on");
const textInput = document.getElementById("edit-text");
const titleInput = document.getElementById("edit-title");
const servingsInput = document.getElementById("edit-servings");
const kindButtons = document.querySelectorAll("#edit-kind .segment");
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
let chosenKind = "meal";

function chooseKind(kind) {
  chosenKind = kind;
  for (const button of kindButtons) {
    const on = button.dataset.kind === kind;
    button.classList.toggle("active", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

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
  // A new recipe starts as the type of the row you came from.
  chooseKind(start ? kindOf(start) : getOpenKind() || "meal");
  servingsInput.value = start && start.servings ? start.servings : "";
  servingsIsAutomatic = !servingsInput.value;
  tagsInput.value = start ? start.tags.join(", ") : "";
  notesInput.value = start ? start.notes : "";
  deleteButton.hidden = !recipe;
  titleIsAutomatic = !start;
  // The heading takes the focus, not the text box: the phone keyboard stays
  // closed until you tap, and on a laptop Tab goes to the text box.
  heading.focus();
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
    kind: chosenKind,
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

// N then Ctrl+V on the laptop: pasting with no text box active still lands
// in the recipe text.
function pasteIntoRecipe(event) {
  if (event.target.closest("input, textarea")) {
    return;
  }
  event.preventDefault();
  textInput.focus();
  textInput.setRangeText(event.clipboardData.getData("text"), textInput.selectionStart, textInput.selectionEnd, "end");
  textInput.dispatchEvent(new Event("input", { bubbles: true }));
}

export function initEditor() {
  form.addEventListener("paste", pasteIntoRecipe);
  for (const button of kindButtons) {
    button.addEventListener("click", () => chooseKind(button.dataset.kind));
  }
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
