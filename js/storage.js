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
  return list.map(normaliseRecipe).filter(Boolean);
}
