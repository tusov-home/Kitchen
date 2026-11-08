// Everything that touches the device's storage: recipes, settings,
// and backup files. Other modules never use localStorage directly.
import { normaliseRecipe } from "./lib/recipes.js";

const RECIPES_KEY = "kitchen.recipes.v1";
const SETTINGS_KEY = "kitchen.settings.v1";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn("Could not read " + key, error);
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn("Could not save " + key, error);
    return false;
  }
}

export function loadRecipes() {
  const list = readJson(RECIPES_KEY, []);
  return Array.isArray(list) ? list.map(normaliseRecipe).filter(Boolean) : [];
}

export function saveRecipes(recipes) {
  return writeJson(RECIPES_KEY, recipes);
}

const SHOPPING_KEY = "kitchen.shopping.v1";

export function loadShopping() {
  const list = readJson(SHOPPING_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveShopping(lists) {
  return writeJson(SHOPPING_KEY, lists);
}

// Running kitchen timers: on this phone only, never synced.
const TIMERS_KEY = "kitchen.timers.v1";

export function loadTimers() {
  const list = readJson(TIMERS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveTimers(timers) {
  return writeJson(TIMERS_KEY, timers);
}

export function loadSettings() {
  // myName: who rates on this phone (each phone has its own).
  return Object.assign({ syncUrl: "", lastSync: 0, myName: "" }, readJson(SETTINGS_KEY, {}));
}

export function saveSettings(settings) {
  return writeJson(SETTINGS_KEY, settings);
}

// Asks Android Chrome not to clear our data when space runs low.
export function askPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(function () {});
  }
}

// Downloads all recipes as a JSON file (backup).
export function exportToFile(recipes) {
  const data = JSON.stringify({ app: "kitchen", version: 1, recipes: recipes }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "kitchen-recipes-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// Reads a backup file and returns the recipes in it.
export async function importFromFile(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data.recipes;
  if (!Array.isArray(list)) {
    throw new Error("This file has no recipes in it.");
  }
  const myName = loadSettings().myName;
  return list.map((raw) => normaliseRecipe(fillImportGaps(raw, myName))).filter(Boolean);
}

// A file written by hand or by Claude may leave out technical fields.
// Fill them in so the recipe still imports: an id made from the title
// (so importing the same file twice doesn't create doubles), today's
// time, this phone's name as owner, and the title as the first line.
export function fillImportGaps(raw, myName) {
  if (!raw || typeof raw !== "object" || (!raw.title && !raw.text)) {
    return raw;
  }
  const recipe = Object.assign({}, raw);
  const title = String(recipe.title || "").trim();
  if (!recipe.id) {
    const slug = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    recipe.id = "import-" + (slug || Date.now().toString(36));
  }
  if (!recipe.updatedAt) {
    recipe.updatedAt = Date.now();
  }
  if (!recipe.owner && myName) {
    recipe.owner = myName;
  }
  if (title && recipe.text && !String(recipe.text).trim().startsWith("#")) {
    recipe.text = "# " + title + "\n\n" + recipe.text;
  }
  if (!recipe.title && recipe.text) {
    recipe.title = String(recipe.text).split("\n")[0].replace(/^#+\s*/, "").trim();
  }
  return recipe;
}
