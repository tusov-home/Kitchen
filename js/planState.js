// The cooking plan, shared between both phones (its own Sheet tab, "plan").
// UI modules change it only through these functions.
import { createCollection } from "./collection.js";
import { PLAN_ID, normalisePlan, mergePlan, planMeals, stepFactor } from "./lib/plan.js";
import * as state from "./state.js";
import * as shopping from "./shoppingState.js";

export const plans = createCollection("plan", normalisePlan, mergePlan);

function plan() {
  return plans.get(PLAN_ID) || { id: PLAN_ID, meals: {} };
}

function setMeal(id, changes) {
  const current = plan();
  const meal = Object.assign({ factor: 1, shopped: false, cooked: false, removed: false }, current.meals[id], changes, { at: Date.now() });
  plans.put(Object.assign({}, current, { meals: Object.assign({}, current.meals, { [id]: meal }) }));
}

// Meals whose recipe still exists, each with its recipe.
export function getMeals() {
  return planMeals(plan())
    .map((meal) => Object.assign(meal, { recipe: state.getRecipe(meal.id) }))
    .filter((meal) => meal.recipe);
}

export function hasMeal(id) {
  return getMeals().some((meal) => meal.id === id);
}

// factor: the servings as shown when adding (2 = double the recipe).
export function addMeal(id, factor) {
  setMeal(id, { factor: factor || 1, shopped: false, cooked: false, removed: false });
}

export function removeMeal(id) {
  setMeal(id, { removed: true });
}

export function stepServings(id, direction) {
  const meal = getMeals().find((entry) => entry.id === id);
  if (meal) {
    setMeal(id, { factor: stepFactor(meal.factor, meal.recipe.servings, direction) });
  }
}

export function setCooked(id, cooked) {
  setMeal(id, { cooked: cooked });
}

// Puts every meal not yet shopped for on the shopping list, each at its
// own servings. Returns how many were added.
export function shopAll() {
  const waiting = getMeals().filter((meal) => !meal.shopped);
  if (waiting.length === 0) {
    return 0;
  }
  const factors = new Map(waiting.map((meal) => [meal.id, meal.factor]));
  // Already on the list (say, added by hand): not added twice.
  const fresh = waiting.filter((meal) => !shopping.hasRecipe(meal.id)).map((meal) => meal.recipe);
  if (fresh.length) {
    shopping.addRecipes(fresh, "add", (recipe) => factors.get(recipe.id));
  }
  const current = plan();
  const now = Date.now();
  const meals = Object.assign({}, current.meals);
  for (const meal of waiting) {
    meals[meal.id] = Object.assign({}, meals[meal.id], { shopped: true, at: now });
  }
  plans.put(Object.assign({}, current, { meals: meals }));
  return waiting.length;
}

// Everything eaten and reviewed: the plan starts empty again.
export function finishPlan() {
  const current = plan();
  const now = Date.now();
  const meals = {};
  for (const [id, meal] of Object.entries(current.meals)) {
    meals[id] = Object.assign({}, meal, { removed: true, at: now });
  }
  plans.put(Object.assign({}, current, { meals: meals }));
}
