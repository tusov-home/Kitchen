// Pure helpers for the pantry: sections, statuses, matching recipe
// ingredients against what you have. No DOM; easy to test.
//
// A pantry item: { id, title: "Rice", section: "Cupboard",
//                  status: "have" | "low" | "out", updatedAt, deleted }
// (Called "title" so the Sheet shows it in its readable title column.)

import { nameKey, sectionFor, parseIngredient } from "./shopping.js";

// The categories every household starts with. People can rename, reorder
// and remove them and add their own; "Other" always stays, as the catch-all.
export const OTHER_SECTION = "Other";
export const DEFAULT_SECTIONS = [
  "Fridge", "Freezer", "Fruit & veg", "Grains, pasta & rice", "Tins & jars", "Cupboard",
  "Oils, vinegars & sauces", "Spices & oils", "Spice mixes", OTHER_SECTION,
];
export const STATUSES = ["have", "low", "out"];
export const STATUS_LABELS = { have: "Have", low: "Low", out: "Out" };

// Where an item is probably kept, guessed from the shop section.
export function guessSection(name) {
  const lower = name.toLowerCase();
  if (/\b(frozen|ice cream|peas)\b/.test(lower)) {
    return "Freezer";
  }
  if (/\b(masala|curry powder|five spice|ras el hanout|za'?atar|spice mix|seasoning)\b/.test(lower)) {
    return "Spice mixes";
  }
  if (/\b(oil|vinegar|sauce|miso|mustard|ketchup|mayo|mayonnaise|tahini)\b/.test(lower)) {
    return "Oils, vinegars & sauces";
  }
  if (/\b(tin|tins|tinned|canned|jar|jars|pickles?|passata|chickpeas|beans)\b/.test(lower)) {
    return "Tins & jars";
  }
  if (/\b(rice|pasta|spaghetti|noodles?|flour|oats|couscous|quinoa|bulgur|barley|polenta)\b/.test(lower)) {
    return "Grains, pasta & rice";
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
  return map[shop] || OTHER_SECTION;
}

// ---------- Categories ----------
// Saved entries only hold what changed: a category stored with a default's
// id overrides it, so both phones start from the same list without storing
// it. A removed category stays stored as hidden, so it never comes back.

export function defaultSectionId(title) {
  return "default-" + title.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
}

export function normaliseSection(raw) {
  if (!raw || typeof raw.id !== "string" || !raw.id) {
    return null;
  }
  return {
    id: raw.id,
    title: String(raw.title || "").trim(),
    order: Number(raw.order) || 0,
    hidden: raw.hidden === true,
    updatedAt: Number(raw.updatedAt) || 0,
    deleted: raw.deleted === true,
  };
}

// The categories to show, in order, with "Other" always last.
export function effectiveSections(stored) {
  const byId = new Map();
  DEFAULT_SECTIONS.forEach(function (title, index) {
    byId.set(defaultSectionId(title), { id: defaultSectionId(title), title: title, order: index * 10 });
  });
  for (const section of stored) {
    if (section.deleted) {
      continue;
    }
    if (section.hidden) {
      byId.delete(section.id);
    } else if (section.title !== OTHER_SECTION) {
      byId.set(section.id, { id: section.id, title: section.title, order: section.order });
    }
  }
  const sections = [...byId.values()].filter((section) => section.title !== OTHER_SECTION);
  sections.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  return [...sections, { id: defaultSectionId(OTHER_SECTION), title: OTHER_SECTION, order: Infinity }];
}

// What's wrong with this name, or "" if it's fine. ownId: the category
// being renamed, which may keep its own name.
export function sectionNameProblem(sections, name, ownId) {
  const clean = name.trim().toLowerCase();
  if (!clean) {
    return "Give the category a name.";
  }
  const taken = sections.some((section) => section.id !== ownId && section.title.toLowerCase() === clean);
  return taken ? "There's already a category with that name." : "";
}

// sections without "Other", after moving one up (-1) or down (+1), with
// fresh order numbers. Returns the same list if it can't move further.
export function reorderSections(sections, id, direction) {
  const list = sections.slice();
  const index = list.findIndex((section) => section.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= list.length) {
    return sections;
  }
  [list[index], list[target]] = [list[target], list[index]];
  return list.map((section, position) => Object.assign({}, section, { order: position * 10 }));
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
    section: String(raw.section || "").trim() || guessSection(title),
    status: STATUSES.includes(raw.status) ? raw.status : "have",
    updatedAt: Number(raw.updatedAt) || 0,
    deleted: raw.deleted === true,
  };
}

// Same name, ignoring plurals and case: "Onions" = "onion".
export function nameKeyOf(title) {
  return nameKey(title);
}

// Items grouped by section, A–Z inside each section. names: the categories
// in order. An item from a category that no longer exists shows under Other.
export function groupPantry(items, names = DEFAULT_SECTIONS) {
  const groups = [];
  for (const section of names) {
    const entries = items
      .filter((item) => (names.includes(item.section) ? item.section : OTHER_SECTION) === section)
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
  ["Salt", "Spices & oils"], ["Black pepper", "Spices & oils"], ["Olive oil", "Oils, vinegars & sauces"],
  ["Neutral oil", "Oils, vinegars & sauces"], ["Cumin", "Spices & oils"], ["Smoked paprika", "Spices & oils"],
  ["Chilli flakes", "Spices & oils"], ["Cinnamon", "Spices & oils"], ["Dried oregano", "Spices & oils"],
  ["Rice", "Grains, pasta & rice"], ["Pasta", "Grains, pasta & rice"], ["Flour", "Grains, pasta & rice"], ["Sugar", "Cupboard"],
  ["Honey", "Cupboard"], ["Soy sauce", "Oils, vinegars & sauces"], ["Dijon mustard", "Oils, vinegars & sauces"],
  ["Tinned tomatoes", "Tins & jars"], ["Stock cubes", "Cupboard"], ["Lentils", "Cupboard"],
  ["Couscous", "Grains, pasta & rice"], ["Onions", "Fruit & veg"], ["Garlic", "Fruit & veg"], ["Lemons", "Fruit & veg"],
  ["Eggs", "Fridge"], ["Butter", "Fridge"], ["Milk", "Fridge"], ["Greek yogurt", "Fridge"],
  ["Parmesan", "Fridge"], ["Frozen peas", "Freezer"],
];
