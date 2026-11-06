// The cooking plan: a row on the recipes page, and its own page. First the
// meals to shop for (servings, remove, "Add to shopping list"), then, once
// shopped, the review: cooked, your stars and a note, and "Finish plan".
import * as state from "../state.js";
import { ask } from "./ask.js";
import * as storage from "../storage.js";
import * as plan from "../planState.js";
import { canEdit, cookedNote } from "../lib/recipes.js";
import { formatAmount } from "../lib/scale.js";
import { getMyName, withMyName } from "./name.js";
import { showToast } from "./toast.js";
import { setQueue } from "./recipeQueue.js";

const rowHead = document.getElementById("plan-head");
const rowCount = document.getElementById("plan-count");
const empty = document.getElementById("plan-empty");
const shopSection = document.getElementById("plan-shop-section");
const shopList = document.getElementById("plan-shop");
const reviewSection = document.getElementById("plan-review-section");
const reviewList = document.getElementById("plan-review");
const shopAllButton = document.getElementById("plan-shop-all");
const finishButton = document.getElementById("plan-finish");
const hideCookedButton = document.getElementById("plan-hide-cooked");

// Hiding cooked meals is remembered on this phone.
function hidingCooked() {
  return storage.loadSettings().planHideCooked === true;
}

// The row above Meals, shown once the plan has a meal. hide: while searching.
export function renderPlanRow(hide) {
  const count = plan.getMeals().length;
  rowHead.hidden = hide || count === 0;
  rowCount.textContent = String(count);
}

function servingsText(meal) {
  const base = meal.recipe.servings;
  return base ? String(Math.round(base * meal.factor)) : "× " + formatAmount(meal.factor);
}

function recipeLink(meal, meals) {
  const link = document.createElement("a");
  link.className = "plan-title";
  link.href = "#/r/" + encodeURIComponent(meal.id);
  link.textContent = meal.recipe.title;
  // Swiping on the recipe goes through the plan.
  link.addEventListener("click", () => setQueue(meals.map((item) => item.id)));
  return link;
}

function iconButton(className, label, text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

// Taking a meal out always asks first: a mistaken tap would lose its place.
export function confirmRemove(meal) {
  ask("Take " + meal.recipe.title + " out of the cooking plan?", "Take out").then(function (yes) {
    if (yes) {
      plan.removeMeal(meal.id);
      showToast("Taken out of the plan");
    }
  });
}

function shopRow(meal, meals) {
  const row = document.createElement("li");
  row.className = "plan-item";
  const stepper = document.createElement("div");
  stepper.className = "dock-stepper plan-stepper";
  const value = document.createElement("span");
  value.className = "step-value plan-servings";
  value.textContent = servingsText(meal);
  stepper.append(
    iconButton("step-button", "Fewer servings", "−", () => plan.stepServings(meal.id, -1)),
    value,
    iconButton("step-button", "More servings", "+", () => plan.stepServings(meal.id, 1))
  );
  const remove = iconButton("shop-remove", "Take " + meal.recipe.title + " out of the plan", "×", () => confirmRemove(meal));
  row.append(recipeLink(meal, meals), stepper, remove);
  return row;
}

function stars(meal) {
  const name = getMyName();
  const recipe = meal.recipe;
  const mine = name && recipe.ratings[name] ? recipe.ratings[name].stars : 0;
  const box = document.createElement("div");
  box.className = "stars plan-stars";
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", "Your rating");
  for (let count = 1; count <= 5; count++) {
    const star = iconButton("star" + (count <= mine ? " filled" : ""), count + (count === 1 ? " star" : " stars"), count <= mine ? "★" : "☆", function () {
      withMyName(function (who) {
        const fresh = state.getRecipe(meal.id);
        const before = fresh && fresh.ratings[who] ? fresh.ratings[who].stars : 0;
        // Your current number again clears it.
        state.setRating(meal.id, who, before === count ? 0 : count);
      });
    });
    star.setAttribute("aria-pressed", count === mine ? "true" : "false");
    box.appendChild(star);
  }
  return box;
}

function noteBox(meal) {
  const form = document.createElement("form");
  form.className = "shop-add plan-note";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Add a note, e.g. less salt";
  input.setAttribute("aria-label", "Note for " + meal.recipe.title);
  input.autocomplete = "off";
  const add = document.createElement("button");
  add.className = "button";
  add.type = "submit";
  add.textContent = "Add";
  form.append(input, add);
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const text = input.value.trim();
    if (text) {
      state.addNote(meal.id, text);
      input.value = "";
      showToast("Added to the notes");
    }
  });
  return form;
}

function reviewRow(meal, meals) {
  const row = document.createElement("li");
  row.className = "plan-item plan-review-item";
  const top = document.createElement("div");
  top.className = "plan-review-top";
  const cooked = document.createElement("label");
  cooked.className = "shop-check plan-cooked";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = meal.cooked;
  box.setAttribute("aria-label", "Cooked " + meal.recipe.title);
  box.addEventListener("change", function () {
    plan.setCooked(meal.id, box.checked);
    // Your own recipe remembers when it was cooked, for the suggestions.
    if (box.checked && canEdit(meal.recipe, getMyName())) {
      state.addNote(meal.id, cookedNote(new Date()));
    }
  });
  cooked.append(box);
  // Shopped but never cooked: it can still leave the plan.
  const remove = iconButton("shop-remove", "Take " + meal.recipe.title + " out of the plan", "×", () => confirmRemove(meal));
  top.append(cooked, recipeLink(meal, meals), remove);
  row.append(top, stars(meal));
  if (canEdit(meal.recipe, getMyName())) {
    row.append(noteBox(meal));
  }
  return row;
}

export function renderPlan() {
  document.title = "Cooking plan · Kitchen";
  const meals = plan.getMeals();
  const toShop = meals.filter((meal) => !meal.shopped);
  const toReview = meals.filter((meal) => meal.shopped);
  // A note being typed stays: the review isn't redrawn under your fingers.
  const typing = reviewList.contains(document.activeElement) && document.activeElement.tagName === "INPUT";

  shopList.replaceChildren(...toShop.map((meal) => shopRow(meal, meals)));
  const hide = hidingCooked();
  const cookedCount = toReview.filter((meal) => meal.cooked).length;
  if (!typing) {
    const shown = hide ? toReview.filter((meal) => !meal.cooked) : toReview;
    reviewList.replaceChildren(...shown.map((meal) => reviewRow(meal, meals)));
  }
  hideCookedButton.hidden = cookedCount === 0;
  hideCookedButton.textContent = hide ? "Show cooked (" + cookedCount + ")" : "Hide cooked";
  hideCookedButton.setAttribute("aria-pressed", hide ? "true" : "false");
  shopSection.hidden = toShop.length === 0;
  reviewSection.hidden = toReview.length === 0;
  empty.hidden = meals.length > 0;

  shopAllButton.hidden = toShop.length === 0;
  shopAllButton.textContent = "Add " + (toShop.length === 1 ? "1 recipe" : toShop.length + " recipes") + " to shopping list";
  finishButton.hidden = toReview.length === 0 || toShop.length > 0;
}

export function initPlan() {
  hideCookedButton.addEventListener("click", function () {
    storage.saveSettings(Object.assign(storage.loadSettings(), { planHideCooked: !hidingCooked() }));
    renderPlan();
  });
  shopAllButton.addEventListener("click", function () {
    const added = plan.shopAll();
    if (added) {
      showToast("Added " + added + (added === 1 ? " recipe" : " recipes") + " to the shopping list");
    }
  });
  finishButton.addEventListener("click", function () {
    const left = plan.getMeals().filter((meal) => !meal.cooked).length;
    const question = left
      ? left + (left === 1 ? " meal isn't" : " meals aren't") + " ticked as cooked. Finish the plan anyway?"
      : "Finish this plan? It starts empty again.";
    ask(question, "Finish plan").then(function (yes) {
      if (yes) {
        plan.finishPlan();
        showToast("Plan finished");
      }
    });
  });
}
