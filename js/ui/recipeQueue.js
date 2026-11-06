// Which recipe comes next when you swipe through recipes: the list you
// opened one from, in the order you saw it.
import * as state from "../state.js";
import { kindOf } from "../lib/recipes.js";

let queue = [];

export function setQueue(ids) {
  queue = ids;
}

// Opened some other way (a link, a reload): the same kind, A–Z.
function fallbackQueue(id) {
  const current = state.getRecipe(id);
  if (!current) {
    return [];
  }
  return state.getRecipes()
    .filter((recipe) => kindOf(recipe) === kindOf(current))
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((recipe) => recipe.id);
}

// The next recipe that still exists, or null at the end.
export function nextRecipeId(id) {
  const ids = queue.includes(id) ? queue : fallbackQueue(id);
  return ids.slice(ids.indexOf(id) + 1).find((next) => state.getRecipe(next)) || null;
}
