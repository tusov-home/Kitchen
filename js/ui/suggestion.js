// "Today's suggestion" at the top of the recipes page: one recipe to
// cook, with a short reason. "Another idea" steps through the day's list.
// The initials in the corner choose whose recipes it picks from.
// Once the cooking plan is shopped for, the card shows the planned meals
// instead (still to cook first), and the arrows step through those.
import * as storage from "../storage.js";
import { dailySuggestions, activeOwners, toggleOwner, recipesOfOwners, initial } from "../lib/suggest.js";
import { allOwners } from "../lib/recipes.js";
import { toDateString } from "../lib/dates.js";
import { getMyName } from "./name.js";
import { setQueue } from "./recipeQueue.js";
import * as plan from "../planState.js";
import { formatAmount } from "../lib/scale.js";

const box = document.getElementById("suggestion");
const label = document.getElementById("suggestion-label");
const link = document.getElementById("suggestion-link");
const reason = document.getElementById("suggestion-reason");
const nextButton = document.getElementById("suggestion-next");
const previousButton = document.getElementById("suggestion-previous");
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
// Which planned meal is shown (this visit only).
let planOffset = 0;

// The shopped-for meals, the ones still to cook first; none before shopping.
function plannedMeals() {
  const shopped = plan.getMeals().filter((meal) => meal.shopped);
  return [...shopped.filter((meal) => !meal.cooked), ...shopped.filter((meal) => meal.cooked)];
}

function plannedReason(meal) {
  const base = meal.recipe.servings;
  const servings = base ? Math.round(base * meal.factor) + " servings" : "× " + formatAmount(meal.factor);
  return servings + (meal.cooked ? " · cooked" : "");
}

// The list the card steps through: [{ recipe, reason }].
function currentList(recipes, today) {
  const planned = plannedMeals();
  if (planned.length) {
    return planned.map((meal) => ({ recipe: meal.recipe, reason: plannedReason(meal) }));
  }
  return todaysList(recipes, today);
}

function inPlanMode() {
  return plannedMeals().length > 0;
}

function getOffset(today) {
  return inPlanMode() ? planOffset : loadOffset(today);
}

function setOffset(today, offset) {
  if (inPlanMode()) {
    planOffset = offset;
  } else {
    saveOffset(today, offset);
  }
}

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
  const planMode = inPlanMode();
  box.hidden = !visible || (recipes.length === 0 && !planMode);
  if (box.hidden) {
    return;
  }
  const now = new Date();
  const today = toDateString(now);
  box.classList.toggle("from-plan", planMode);
  if (planMode) {
    ownerButtons.hidden = true;
  } else {
    renderOwners(recipes);
  }
  const list = currentList(recipes, today);
  const offset = getOffset(today);
  const pick = list[offset % list.length];
  shownId = pick.recipe.id;
  const href = "#/r/" + encodeURIComponent(pick.recipe.id);

  label.textContent = planMode
    ? "From the cooking plan: " + ((offset % list.length) + 1) + " of " + list.length
    : "Suggestion for " + now.toLocaleDateString("en-GB", { weekday: "long" });
  link.textContent = pick.recipe.title;
  link.href = href;
  reason.textContent = pick.reason;
  reason.hidden = !pick.reason;
  // Switched off arrows are invisible, and a tap there opens the recipe.
  nextButton.disabled = list.length < 2;
  previousButton.disabled = list.length < 2 || offset === 0;
  nextButton.title = planMode ? "Next planned meal" : "Another idea";
  nextButton.setAttribute("aria-label", nextButton.title);
  previousButton.title = planMode ? "Previous planned meal" : "Back to the previous idea";
  previousButton.setAttribute("aria-label", previousButton.title);
}

// Swiping on the recipe goes on through today's other ideas.
function queueFromHere() {
  const ids = currentList(lastRecipes, toDateString(new Date())).map((item) => item.recipe.id);
  const start = ids.indexOf(shownId);
  setQueue([...ids.slice(start), ...ids.slice(0, start)]);
}

// Steps through the day's list: +1 another idea, -1 back to the one before.
let turning = false;

function step(by) {
  const today = toDateString(new Date());
  const show = function () {
    setOffset(today, Math.max(getOffset(today) + by, 0));
    renderSuggestion(lastRecipes, true);
  };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    show();
    showChange();
    return;
  }
  if (turning) {
    return;
  }
  // Turn the card away, put the next recipe on it, turn it back.
  turning = true;
  const way = by > 0 ? "next" : "back";
  box.classList.remove("changed");
  box.classList.add("flip-out-" + way);
  box.addEventListener("animationend", function () {
    show();
    box.classList.remove("flip-out-" + way);
    box.classList.add("flip-in-" + way);
    box.addEventListener("animationend", function () {
      box.classList.remove("flip-in-" + way);
      turning = false;
    }, { once: true });
  }, { once: true });
}

// A quick tap still shows the card being pushed, then the recipe rises.
function openWithPress(event) {
  queueFromHere();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  event.preventDefault();
  box.classList.add("pressed");
  setTimeout(function () {
    location.hash = link.getAttribute("href");
    // Stays pressed while the sheet rises, then lets go without moving.
    setTimeout(function () {
      box.classList.add("unpress");
      box.classList.remove("pressed");
      void box.offsetWidth;
      box.classList.remove("unpress");
    }, 400);
  }, 130);
}

export function initSuggestion() {
  previousButton.addEventListener("click", () => step(-1));
  link.addEventListener("click", openWithPress);
  nextButton.addEventListener("click", () => step(1));
  // The whole card opens the recipe, also the space between the arrows;
  // only its buttons do something else.
  box.addEventListener("click", function (event) {
    if (event.target.closest("button, a")) {
      return;
    }
    openWithPress(event);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      location.hash = link.getAttribute("href");
    }
  });
}
