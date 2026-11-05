// All keyboard shortcuts live here, in one table.
// "where" says on which screen a shortcut works: list, recipe, edit or any.
// "whileTyping: true" means it also works inside text boxes.
const SHORTCUTS = [
  { keys: "n", label: "N", action: "addRecipe", where: ["list", "recipe"], text: "Add recipe" },
  { keys: "/", label: "/", action: "focusSearch", where: ["list"], text: "Search" },
  { keys: "f", label: "F", action: "toggleFilters", where: ["list"], text: "Show / hide filters" },
  { keys: "e", label: "E", action: "editRecipe", where: ["recipe"], text: "Edit recipe (your own)" },
  { keys: "c", label: "C", action: "copyRecipe", where: ["recipe"], text: "Make my copy" },
  { keys: "1", label: "1 … 5", action: "rate1", where: ["recipe"], text: "Rate 1–5 stars (same again clears)" },
  { keys: "2", action: "rate2", where: ["recipe"] },
  { keys: "3", action: "rate3", where: ["recipe"] },
  { keys: "4", action: "rate4", where: ["recipe"] },
  { keys: "5", action: "rate5", where: ["recipe"] },
  { keys: "+", label: "+ / −", action: "moreServings", where: ["recipe"], text: "More / fewer servings" },
  { keys: "=", action: "moreServings", where: ["recipe"] },
  { keys: "-", action: "fewerServings", where: ["recipe"] },
  { keys: "ctrl+s", label: "Ctrl+S", action: "save", where: ["edit"], whileTyping: true, text: "Save recipe" },
  { keys: "escape", label: "Esc", action: "back", where: ["list", "recipe", "edit", "shopping", "pantry", "chores", "projects", "project"], whileTyping: true, text: "Back / cancel" },
  { keys: "arrowleft", label: "← / →", action: "previousTab", where: ["list", "shopping", "pantry", "chores", "projects"], text: "Previous / next page" },
  { keys: "arrowright", action: "nextTab", where: ["list", "shopping", "pantry", "chores", "projects"] },
  { keys: "n", label: "N", action: "focusPantryAdd", where: ["pantry"], text: "Pantry: add an item" },
  { keys: "n", label: "N", action: "addChore", where: ["chores"], text: "Chores: add a chore" },
  { keys: "n", label: "N", action: "addProject", where: ["projects"], text: "Projects: add a project" },
  { keys: "e", label: "E", action: "editProject", where: ["project"], text: "Project: edit" },
  { keys: "l", label: "L", action: "openShopping", where: ["list", "recipe"], text: "Open shopping list" },
  { keys: "p", label: "P", action: "togglePlanning", where: ["list"], text: "Plan shopping: pick recipes" },
  { keys: "?", label: "?", action: "showHelp", where: ["any"], text: "Show this list" },
];

function isTyping(target) {
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

// Turns a key press into "ctrl+s", "n", "escape", "?" …
// Cmd on a Mac counts as Ctrl.
function keyName(event) {
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    return "ctrl+" + key;
  }
  if (event.altKey) {
    return "alt+" + key;
  }
  return key;
}

function fillHelpTable() {
  const table = document.getElementById("shortcut-table");
  table.replaceChildren();
  for (const shortcut of SHORTCUTS) {
    // Extra keys for the same action (e.g. 2–5) have no label of their own.
    if (!shortcut.label) {
      continue;
    }
    const row = table.insertRow();
    const keyCell = row.insertCell();
    const kbd = document.createElement("kbd");
    kbd.textContent = shortcut.label;
    keyCell.appendChild(kbd);
    row.insertCell().textContent = shortcut.text;
  }
}

// actions: { addRecipe: fn, ... }
// getScreen: function returning "list", "recipe" or "edit"
export function initShortcuts(actions, getScreen) {
  fillHelpTable();

  document.addEventListener("keydown", function (event) {
    // Let open dialogs handle their own keys (Esc closes them).
    if (document.querySelector("dialog[open]")) {
      return;
    }
    const name = keyName(event);
    const typing = isTyping(event.target);
    const screen = getScreen();

    for (const shortcut of SHORTCUTS) {
      if (shortcut.keys !== name) {
        continue;
      }
      if (typing && !shortcut.whileTyping) {
        continue;
      }
      if (!shortcut.where.includes("any") && !shortcut.where.includes(screen)) {
        continue;
      }
      event.preventDefault();
      actions[shortcut.action]();
      return;
    }
  });
}
