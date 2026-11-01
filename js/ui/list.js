// The recipe list: search box, tag filter and the list itself.
import * as state from "../state.js";
import * as storage from "../storage.js";
import { visibleRecipes, allTags, allOwners, averageRating } from "../lib/recipes.js";
import { isPlanning, isSelected, toggleSelected } from "./plan.js";

const searchInput = document.getElementById("search");
const tagFilter = document.getElementById("tag-filter");
const list = document.getElementById("recipe-list");
const emptyList = document.getElementById("empty-list");
const noResults = document.getElementById("no-results");

const ownerFilter = document.getElementById("owner-filter");
const sortSelect = document.getElementById("sort-select");

let activeTag = "";
// Owner filter and sort are remembered on this phone.
let activeOwner = storage.loadSettings().listOwner || "";
let sortOrder = storage.loadSettings().listSort || "newest";

function rememberView() {
  storage.saveSettings(Object.assign(storage.loadSettings(), { listOwner: activeOwner, listSort: sortOrder }));
}

// "Everyone · Kristiina · Tõnis", shown once there are two owners.
function renderOwnerFilter(owners) {
  ownerFilter.replaceChildren();
  ownerFilter.hidden = owners.length < 2;
  if (ownerFilter.hidden) {
    return;
  }
  for (const owner of ["", ...owners]) {
    ownerFilter.appendChild(
      tagChip(owner || "Everyone", owner === activeOwner, function () {
        activeOwner = owner;
        rememberView();
        renderList();
      })
    );
  }
}

function tagChip(tag, selected, onClick) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "tag" + (selected ? " selected" : "");
  chip.textContent = tag;
  chip.setAttribute("aria-pressed", selected ? "true" : "false");
  chip.addEventListener("click", onClick);
  return chip;
}

export function renderList() {
  const all = state.getRecipes();
  const tags = allTags(all);
  if (!tags.includes(activeTag)) {
    activeTag = "";
  }
  const owners = allOwners(all);
  if (owners.length < 2 || !owners.includes(activeOwner)) {
    activeOwner = "";
  }
  renderOwnerFilter(owners);
  sortSelect.value = sortOrder;

  // Tag filter chips
  tagFilter.replaceChildren();
  for (const tag of tags) {
    tagFilter.appendChild(
      tagChip(tag, tag === activeTag, function () {
        activeTag = activeTag === tag ? "" : tag;
        renderList();
      })
    );
  }

  // The list
  const shown = visibleRecipes(all, searchInput.value, activeTag, { owner: activeOwner, sort: sortOrder });
  list.replaceChildren();
  for (const recipe of shown) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = "#/r/" + encodeURIComponent(recipe.id);
    link.className = "recipe-card";

    // While planning, a tap picks the recipe instead of opening it.
    if (isPlanning()) {
      const picked = isSelected(recipe.id);
      link.classList.add("pickable");
      link.classList.toggle("picked", picked);
      link.setAttribute("role", "checkbox");
      link.setAttribute("aria-checked", picked ? "true" : "false");
      const box = document.createElement("span");
      box.className = "pick-box";
      box.textContent = picked ? "✓" : "";
      box.setAttribute("aria-hidden", "true");
      link.appendChild(box);
      link.addEventListener("click", function (event) {
        event.preventDefault();
        toggleSelected(recipe.id);
      });
    }

    const title = document.createElement("span");
    title.className = "recipe-card-title";
    title.textContent = recipe.title;
    link.appendChild(title);

    // Info line: ★ 4.5 · Kadi · quick · weekend
    const average = averageRating(recipe);
    const parts = [];
    if (average !== null) {
      const stars = document.createElement("span");
      stars.className = "card-stars";
      stars.textContent = "★ " + (Math.round(average * 10) / 10);
      stars.setAttribute("aria-label", "Rated " + average.toFixed(1) + " of 5");
      parts.push(stars);
    }
    if (recipe.owner) {
      const owner = document.createElement("span");
      owner.className = "card-owner";
      owner.textContent = recipe.owner;
      parts.push(owner);
    }
    if (recipe.tags.length) {
      parts.push(recipe.tags.join(" · "));
    }
    if (parts.length) {
      const infoLine = document.createElement("span");
      infoLine.className = "recipe-card-tags";
      parts.forEach(function (part, index) {
        if (index > 0) {
          infoLine.append("  ·  ");
        }
        infoLine.append(part);
      });
      link.appendChild(infoLine);
    }

    item.appendChild(link);
    list.appendChild(item);
  }

  emptyList.hidden = all.length > 0;
  noResults.hidden = all.length === 0 || shown.length > 0;
}

export function focusSearch() {
  searchInput.focus();
  searchInput.select();
}

export function initList() {
  searchInput.addEventListener("input", renderList);
  sortSelect.addEventListener("change", function () {
    sortOrder = sortSelect.value;
    rememberView();
    renderList();
  });
}
