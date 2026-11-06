// "Today's suggestion" at the top of the recipes page: one recipe to
// cook, with a short reason. "Another idea" steps through the day's list.
// The initials in the corner choose whose recipes it picks from.
import * as storage from "../storage.js";
import { dailySuggestions, activeOwners, toggleOwner, recipesOfOwners, initial } from "../lib/suggest.js";
import { allOwners } from "../lib/recipes.js";
import { toDateString } from "../lib/dates.js";
import { getMyName } from "./name.js";
import { setQueue } from "./recipeQueue.js";

const box = document.getElementById("suggestion");
const label = document.getElementById("suggestion-label");
const link = document.getElementById("suggestion-link");
const reason = document.getElementById("suggestion-reason");
const openButton = document.getElementById("suggestion-open");
const nextButton = document.getElementById("suggestion-next");
const ownerButtons = document.getElementById("suggestion-owners");

const KEY = "kitchen.suggestion.v1";

// How many times "Another idea" was tapped today (on this phone).
function loadOffset(today) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    return saved.date === today ? saved.offset || 0 : 0;
  } catch (error) {
    return 0;
  }
}

function saveOffset(today, offset) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ date: today, offset: offset }));
  } catch (error) {
    // Not important enough to bother anyone about.
  }
}

let lastRecipes = [];
let shownId = "";

function currentOwners(owners) {
  return activeOwners(owners, storage.loadSettings().suggestOwners, getMyName());
}

// The day's list, from the chosen owners' recipes only.
function todaysList(recipes, today) {
  const owners = allOwners(recipes);
  const pool = owners.length < 2 ? recipes : recipesOfOwners(recipes, currentOwners(owners));
  return dailySuggestions(pool, today);
}

function setOwners(next) {
  storage.saveSettings(Object.assign(storage.loadSettings(), { suggestOwners: next }));
  // Keep the dish on screen if it still counts; the change then applies
  // from the next suggestion on.
  const today = toDateString(new Date());
  const index = todaysList(lastRecipes, today).findIndex((item) => item.recipe.id === shownId);
  saveOffset(today, Math.max(index, 0));
  const before = shownId;
  renderSuggestion(lastRecipes, true);
  if (shownId !== before) {
    showChange();
  }
}

// One initial per person, shown once there are two owners.
function renderOwners(recipes) {
  const owners = allOwners(recipes);
  const active = currentOwners(owners);
  ownerButtons.replaceChildren();
  ownerButtons.hidden = owners.length < 2;
  if (ownerButtons.hidden) {
    return;
  }
  // This phone's own person first, so the buttons read "me, then you".
  const mine = getMyName();
  const ordered = [...owners].sort((a, b) => (b === mine) - (a === mine));
  for (const owner of ordered) {
    const on = active.includes(owner);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tag owner-initial" + (on ? " selected" : "");
    button.textContent = initial(owner);
    button.title = owner + "'s recipes (" + initial(owner) + ")";
    button.setAttribute("aria-label", owner + "'s recipes");
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.addEventListener("click", () => setOwners(toggleOwner(active, owner)));
    ownerButtons.appendChild(button);
  }
}

// For the keyboard: T or K.
export function toggleSuggestionOwner(letter) {
  if (box.hidden) {
    return;
  }
  const button = [...ownerButtons.children].find((item) => item.textContent === letter);
  if (button) {
    button.click();
  }
}

function showChange() {
  // A soft fade so you can see it changed.
  box.classList.remove("changed");
  void box.offsetWidth;
  box.classList.add("changed");
}

// visible: false while searching, so the list has the stage.
export function renderSuggestion(recipes, visible) {
  lastRecipes = recipes;
  box.hidden = !visible || recipes.length === 0;
  if (box.hidden) {
    return;
  }
  const now = new Date();
  const today = toDateString(now);
  renderOwners(recipes);
  const list = todaysList(recipes, today);
  const pick = list[loadOffset(today) % list.length];
  shownId = pick.recipe.id;
  const href = "#/r/" + encodeURIComponent(pick.recipe.id);

  label.textContent = "Suggestion for " + now.toLocaleDateString("en-GB", { weekday: "long" });
  link.textContent = pick.recipe.title;
  link.href = href;
  openButton.href = href;
  reason.textContent = pick.reason;
  reason.hidden = !pick.reason;
  nextButton.hidden = list.length < 2;
}

// Swiping on the recipe goes on through today's other ideas.
function queueFromHere() {
  const ids = todaysList(lastRecipes, toDateString(new Date())).map((item) => item.recipe.id);
  const start = ids.indexOf(shownId);
  setQueue([...ids.slice(start), ...ids.slice(0, start)]);
}

export function initSuggestion() {
  link.addEventListener("click", queueFromHere);
  openButton.addEventListener("click", queueFromHere);
  nextButton.addEventListener("click", function () {
    const today = toDateString(new Date());
    saveOffset(today, loadOffset(today) + 1);
    renderSuggestion(lastRecipes, true);
    showChange();
  });
}
