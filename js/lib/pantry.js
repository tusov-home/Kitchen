// Pure helpers for the pantry: sections, statuses, matching recipe
// ingredients against what you have. No DOM; easy to test.
//
// A pantry item: { id, title: "Rice", section: "Cupboard",
//                  status: "have" | "low" | "out", updatedAt, deleted }
// (Called "title" so the Sheet shows it in its readable title column.)

import { nameKey, sectionFor, parseIngredient } from "./shopping.js";

export const PANTRY_SECTIONS = ["Fridge", "Freezer", "Fruit & veg", "Cupboard", "Spices & oils", "Other"];
export const STATUSES = ["have", "low", "out"];
export const STATUS_LABELS = { have: "Have", low: "Low", out: "Out" };

// Where an item is probably kept, guessed from the shop section.
export function guessSection(name) {
  const lower = name.toLowerCase();
  if (/\b(frozen|ice cream|peas)\b/.test(lower)) {
    return "Freezer";
  }
  const shop = sectionFor(parseIngredient(name));
  const map = {
    "Dairy & eggs": "Fridge",
    "Meat & fish": "Fridge",
    "Produce": "Fruit & veg",
    "Pantry": "Cupboard",
    "Bakery": "Cupboard",
    "Check you have": "Spices & oils",
  };
  return map[shop] || "Other";
}

// Have → Low → Out → Have
export function nextStatus(status) {
  const index = STATUSES.indexOf(status);
  return STATUSES[(index + 1) % STATUSES.length];
}

export function normalisePantryItem(raw) {
  if (!raw || typeof raw.id !== "string" || !raw.id) {
    return null;
  }
  const title = String(raw.title || "").trim();
  return {
    id: raw.id,
    title: title,
    section: PANTRY_SECTIONS.includes(raw.section) ? raw.section : guessSection(title),
    status: STATUSES.includes(raw.status) ? raw.status : "have",
    updatedAt: Number(raw.updatedAt) || 0,
    deleted: raw.deleted === true,
  };
}

// Same name, ignoring plurals and case: "Onions" = "onion".
export function nameKeyOf(title) {
  return nameKey(title);
}

// Items grouped by section, A–Z inside each section.
export function groupPantry(items) {
  const groups = [];
  for (const section of PANTRY_SECTIONS) {
    const entries = items
      .filter((item) => item.section === section)
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
    if (entries.length) {
      groups.push({ section: section, items: entries });
    }
  }
  return groups;
}

export function lowOrOut(items) {
  return items.filter((item) => item.status === "low" || item.status === "out");
}

// Does a pantry item cover this ingredient? "rice" covers "brown rice"
// and "300 g rice"; "olive oil" covers "2 tbsp olive oil". All words of
// the pantry name must appear in the ingredient's name.
export function pantryCovers(pantryTitle, ingredientName) {
  const pantryWords = nameKey(pantryTitle).split(" ").filter(Boolean);
  const ingredientWords = nameKey(ingredientName).split(" ");
  return pantryWords.length > 0 && pantryWords.every((word) => ingredientWords.includes(word));
}

// The pantry item (that you have) covering an ingredient, or null.
// Items marked low or out don't count: you still need to buy those.
export function findInPantry(items, ingredientName) {
  return items.find((item) => item.status === "have" && pantryCovers(item.title, ingredientName)) || null;
}

// A starting point, so the pantry isn't empty on day one.
export const STAPLES = [
  ["Salt", "Spices & oils"], ["Black pepper", "Spices & oils"], ["Olive oil", "Spices & oils"],
  ["Neutral oil", "Spices & oils"], ["Cumin", "Spices & oils"], ["Smoked paprika", "Spices & oils"],
  ["Chilli flakes", "Spices & oils"], ["Cinnamon", "Spices & oils"], ["Dried oregano", "Spices & oils"],
  ["Rice", "Cupboard"], ["Pasta", "Cupboard"], ["Flour", "Cupboard"], ["Sugar", "Cupboard"],
  ["Honey", "Cupboard"], ["Soy sauce", "Cupboard"], ["Dijon mustard", "Cupboard"],
  ["Tinned tomatoes", "Cupboard"], ["Stock cubes", "Cupboard"], ["Lentils", "Cupboard"],
  ["Couscous", "Cupboard"], ["Onions", "Fruit & veg"], ["Garlic", "Fruit & veg"], ["Lemons", "Fruit & veg"],
  ["Eggs", "Fridge"], ["Butter", "Fridge"], ["Milk", "Fridge"], ["Greek yogurt", "Fridge"],
  ["Parmesan", "Fridge"], ["Frozen peas", "Freezer"],
];
