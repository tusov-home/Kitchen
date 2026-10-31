// The app's data and the only place that changes it.
// UI modules read through get...() and change through the other functions.
import * as storage from "./storage.js";
import { mergeRecipes, newId } from "./lib/recipes.js";

// Includes deleted markers (needed for sync); the UI never sees those.
let recipes = storage.loadRecipes();
const listeners = [];

function changed(fromSync) {
  storage.saveRecipes(recipes);
  for (const listener of listeners) {
    listener({ fromSync: fromSync === true });
  }
}

// Called after every change. fromSync tells whether the change came
// from the Sheet (then there is no need to sync again).
export function onChange(listener) {
  listeners.push(listener);
}

export function getRecipes() {
  return recipes.filter((r) => !r.deleted);
}

export function getRecipe(id) {
  return recipes.find((r) => r.id === id && !r.deleted) || null;
}

export function getAllForSync() {
  return recipes;
}

// Adds a new recipe (no id) or updates an existing one. Returns the id.
export function saveRecipe(input) {
  const id = input.id || newId();
  const existing = getRecipe(id);
  const recipe = {
    id: id,
    title: input.title.trim(),
    text: input.text.trim(),
    tags: input.tags || [],
    notes: (input.notes || "").trim(),
    servings: input.servings || null,
    // Ratings are changed only through setRating, so keep them on edits.
    ratings: input.ratings || (existing ? existing.ratings : {}),
    // The owner stays the same once set; a recipe from before owners
    // existed gets the person who first saves it.
    owner: (existing && existing.owner) || input.owner || "",
    copyOf: input.copyOf || (existing ? existing.copyOf : "") || "",
    updatedAt: Date.now(),
    deleted: false,
  };
  recipes = recipes.filter((r) => r.id !== id);
  recipes.push(recipe);
  if (getRecipes().length === 1) {
    storage.askPersistentStorage();
  }
  changed();
  return id;
}

// Adds a line to a recipe's notes, e.g. "Cooked 12 Nov 2026".
export function addNote(id, line) {
  const recipe = getRecipe(id);
  if (!recipe) {
    return;
  }
  const notes = recipe.notes ? recipe.notes + "\n" + line : line;
  saveRecipe(Object.assign({}, recipe, { notes: notes }));
}

// Sets one person's stars (1–5), or clears them (0). Each rating keeps
// its own time, so ratings from two phones merge without overwriting
// each other, and rating doesn't count as editing the recipe.
export function setRating(id, name, stars) {
  const recipe = getRecipe(id);
  if (!recipe || !name) {
    return;
  }
  const ratings = Object.assign({}, recipe.ratings);
  ratings[name] = { stars: stars, at: Date.now() };
  recipes = recipes.map((r) => (r.id === id ? Object.assign({}, r, { ratings: ratings }) : r));
  changed();
}

// Keeps a small "deleted" marker so the deletion syncs to other devices.
export function deleteRecipe(id) {
  recipes = recipes.filter((r) => r.id !== id);
  recipes.push({
    id: id, title: "", text: "", tags: [], notes: "", servings: null, ratings: {}, owner: "", copyOf: "",
    updatedAt: Date.now(), deleted: true,
  });
  changed();
}

// Merges recipes from a backup file or from the Sheet.
export function mergeIn(list, fromSync) {
  recipes = mergeRecipes(recipes, list);
  changed(fromSync);
}
