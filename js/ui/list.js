// The recipe list: search box, tag filter and the list itself.
import * as state from "../state.js";
import { visibleRecipes, allTags, averageRating } from "../lib/recipes.js";

const searchInput = document.getElementById("search");
const tagFilter = document.getElementById("tag-filter");
const list = document.getElementById("recipe-list");
const emptyList = document.getElementById("empty-list");
const noResults = document.getElementById("no-results");

let activeTag = "";

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
  const shown = visibleRecipes(all, searchInput.value, activeTag);
  list.replaceChildren();
  for (const recipe of shown) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = "#/r/" + encodeURIComponent(recipe.id);
    link.className = "recipe-card";

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
}
