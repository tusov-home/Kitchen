// The recipes page: today's suggestion and the rows Cooking plan, Meals and
// Sauces & condiments, with search and + in the bottom bar. Meals, sauces
// and search results open in one sheet on top (#view-browse), which holds
// the list and its filters.
import * as state from "../state.js";
import * as storage from "../storage.js";
import { visibleRecipes, allTags, allOwners, averageRating, kindOf } from "../lib/recipes.js";
import { renderSuggestion, initSuggestion } from "./suggestion.js";
import { setQueue } from "./recipeQueue.js";
import { renderPlanRow } from "./plan.js";

const searchInput = document.getElementById("search");
const tagFilter = document.getElementById("tag-filter");
const list = document.getElementById("recipe-list");
const emptyList = document.getElementById("empty-list");
const noResults = document.getElementById("no-results");

const ownerFilter = document.getElementById("owner-filter");
const sortSelect = document.getElementById("sort-select");
const filterToggle = document.getElementById("filter-toggle");
const filterPanel = document.getElementById("filter-panel");
const recipeCount = document.getElementById("recipe-count");
const sauceCount = document.getElementById("sauce-count");
const browseTitle = document.getElementById("browse-title");
const welcome = document.getElementById("welcome");
const mealsHead = document.getElementById("meals-head");
const saucesHead = document.getElementById("sauces-head");

// What the sheet shows: "meal", "sauce" or "search". Set by the address.
let openKind = "meal";
let filterOpen = false;

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
  const meals = all.filter((recipe) => kindOf(recipe) === "meal");
  // Searching looks through everything, meals and sauces.
  const searching = Boolean(searchInput.value.trim()) || openKind === "search";
  const everything = searching || all.length === 0;
  const pool = everything ? all : all.filter((recipe) => kindOf(recipe) === openKind);
  const tags = allTags(pool);
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
  const shown = visibleRecipes(pool, searchInput.value, activeTag, { owner: activeOwner, sort: sortOrder });
  list.replaceChildren();
  for (const recipe of shown) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = "#/r/" + encodeURIComponent(recipe.id);
    // Swiping on the recipe goes through this list, as you see it now.
    link.addEventListener("click", () => setQueue(shown.map((item) => item.id)));
    link.className = "recipe-card";

    const title = document.createElement("span");
    title.className = "recipe-card-title";
    title.textContent = recipe.title;
    link.appendChild(title);

    // Info line: ★ 4.5 · Kadi · quick · weekend
    const average = averageRating(recipe);
    const parts = [];
    if (everything && kindOf(recipe) === "sauce") {
      parts.push("Sauce or condiment");
    }
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
  noResults.textContent = pool.length === 0 ? "No sauces or condiments yet. Tap + to add one." : "No recipes match your search.";

  // How many in each row.
  const sauces = all.length - meals.length;
  recipeCount.textContent = String(meals.length);
  sauceCount.textContent = String(sauces);
  browseTitle.textContent = searching ? "Search" : openKind === "sauce" ? "Sauces & condiments" : "Meals";

  // Filter panel: open on request; it also stays open while a filter is
  // active, so a hidden filter never makes recipes seem to disappear.
  const activeFilters = (activeOwner ? 1 : 0) + (activeTag ? 1 : 0);
  filterPanel.hidden = !(filterOpen || activeFilters > 0) || pool.length === 0;
  filterToggle.hidden = pool.length === 0;
  filterToggle.textContent = activeFilters ? "Filter (" + activeFilters + ")" : "Filter";
  filterToggle.setAttribute("aria-expanded", filterPanel.hidden ? "false" : "true");

  // A new recipe book: no rows yet, just how to add the first recipe.
  welcome.hidden = all.length > 0;
  mealsHead.hidden = all.length === 0;
  saucesHead.hidden = all.length === 0;
  renderPlanRow(false);
  renderSuggestion(meals, true);
}

// The address decides what the sheet shows: "meal", "sauce" or "search".
export function setBrowse(kind) {
  openKind = kind;
}

export function getBrowse() {
  return openKind;
}

// + starts a recipe of the type being looked at (meal unless in sauces).
export function getOpenKind() {
  return openKind === "sauce" ? "sauce" : "meal";
}

export function getSearch() {
  return searchInput.value.trim();
}

export function clearSearch() {
  searchInput.value = "";
}

// F on the recipes page: the filters show when the sheet opens.
export function openFilters() {
  filterOpen = true;
}

export function toggleFilters() {
  filterOpen = filterPanel.hidden;
  if (!filterOpen) {
    // Closing also clears the filters, so nothing stays hidden.
    activeOwner = "";
    activeTag = "";
    rememberView();
  }
  renderList();
}

export function focusSearch() {
  searchInput.focus();
  searchInput.select();
}

// onSearch: called on every change of the search text, after the redraw.
export function initList(onSearch) {
  initSuggestion();
  searchInput.addEventListener("input", function () {
    renderList();
    onSearch(searchInput.value.trim());
  });
  // Enter closes the phone keyboard, so the results can be seen.
  searchInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      searchInput.blur();
    }
  });
  filterToggle.addEventListener("click", toggleFilters);
  sortSelect.addEventListener("change", function () {
    sortOrder = sortSelect.value;
    rememberView();
    renderList();
  });
}
