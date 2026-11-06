// The shopping list screen: items by shop section, tick off as you shop.
import * as shopping from "../shoppingState.js";
import { ask } from "./ask.js";
import { groupBySection, itemLabel, progress } from "../lib/shopping.js";
import { showToast } from "./toast.js";

const recipesLine = document.getElementById("shop-recipes");
const progressBox = document.getElementById("shop-progress");
const progressText = document.getElementById("shop-progress-text");
const progressFill = document.getElementById("shop-progress-fill");
const addForm = document.getElementById("shop-add");
const addInput = document.getElementById("shop-add-input");
const sections = document.getElementById("shop-sections");
const empty = document.getElementById("shop-empty");
const footer = document.getElementById("shop-footer");
const tickedBox = document.getElementById("shop-ticked");
const tickedLabel = document.getElementById("shop-ticked-label");
const tickedItems = document.getElementById("shop-ticked-items");
const removeTickedButton = document.getElementById("shop-remove-ticked");
const deleteButton = document.getElementById("shop-delete");
const cartCount = document.getElementById("cart-count");

// The little number on the Shopping tab: items still to buy.
export function renderCartCount() {
  const list = shopping.getCurrent();
  const p = list ? progress(list.items) : { done: 0, total: 0 };
  const left = p.total - p.done;
  cartCount.hidden = left === 0;
  cartCount.textContent = left > 99 ? "99+" : String(left);
}

function itemRow(key, item) {
  const row = document.createElement("li");
  row.className = "shop-item" + (item.checked ? " checked" : "");

  const label = document.createElement("label");
  label.className = "shop-check";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = item.checked;
  box.addEventListener("change", () => shopping.toggleItem(key));
  const text = document.createElement("span");
  text.className = "shop-text";
  const name = document.createElement("span");
  name.className = "shop-name";
  name.textContent = itemLabel(item);
  text.appendChild(name);
  const notes = (item.inPantry ? ["In your pantry"] : []).concat(item.sources);
  if (notes.length) {
    const from = document.createElement("span");
    from.className = "shop-from";
    from.textContent = notes.join(" · ");
    text.appendChild(from);
  }
  label.append(box, text);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "shop-remove";
  remove.textContent = "×";
  remove.title = "Remove (e.g. already have it)";
  remove.setAttribute("aria-label", "Remove " + itemLabel(item));
  remove.addEventListener("click", () => shopping.removeItem(key));

  row.append(label, remove);
  return row;
}

export function renderShopping() {
  document.title = "Shopping list · Kitchen";
  const list = shopping.getCurrent();
  const groups = list ? groupBySection(list.items) : [];
  const p = list ? progress(list.items) : { done: 0, total: 0 };

  // Which recipes it's for: "For: Ragu (2) · Menemen (2)"
  const recipes = list ? Object.values(list.recipes).filter((recipe) => !recipe.removed) : [];
  recipesLine.textContent = recipes.length
    ? "For: " + recipes.map((r) => r.title + (r.servings ? " (" + r.servings + ")" : "")).join(" · ")
    : "";
  recipesLine.hidden = recipes.length === 0;

  progressBox.hidden = p.total === 0;
  progressText.textContent = p.done + " of " + p.total + " ticked";
  progressFill.style.width = (p.total ? Math.round((p.done / p.total) * 100) : 0) + "%";

  // Only what's left to buy stays in view; ticked things fold away below.
  sections.replaceChildren();
  tickedItems.replaceChildren();
  for (const group of groups) {
    for (const entry of group.entries.filter((item) => item.item.checked)) {
      tickedItems.appendChild(itemRow(entry.key, entry.item));
    }
    const left = group.entries.filter((item) => !item.item.checked);
    if (left.length === 0) {
      continue;
    }
    const section = document.createElement("section");
    section.className = "shop-section";
    const heading = document.createElement("h2");
    heading.textContent = group.section;
    const items = document.createElement("ul");
    items.className = "shop-items";
    for (const entry of left) {
      items.appendChild(itemRow(entry.key, entry.item));
    }
    section.append(heading, items);
    sections.appendChild(section);
  }
  tickedBox.hidden = p.done === 0;
  tickedLabel.textContent = "Ticked (" + p.done + ")";

  empty.hidden = p.total > 0;
  footer.hidden = p.total === 0;
  removeTickedButton.disabled = p.done === 0;
  renderCartCount();
}

export function initShopping() {
  addForm.addEventListener("submit", function (event) {
    event.preventDefault();
    shopping.addOwnItem(addInput.value);
    addInput.value = "";
    addInput.focus();
  });
  removeTickedButton.addEventListener("click", function () {
    const count = shopping.removeTicked();
    if (count) {
      showToast("Removed " + count + " ticked");
    }
  });
  deleteButton.addEventListener("click", function () {
    ask("Clear the whole shopping list? This also clears it on the other phone.", "Start over", true).then(function (yes) {
      if (yes) {
        shopping.deleteCurrent();
      }
    });
  });
}
