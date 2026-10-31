// Pure helpers for the shopping list: read ingredient lines, sort them
// into shop sections, add up the same ingredient from several recipes,
// and merge lists from two phones. No DOM; easy to test.
//
// A shopping list looks like:
// { id, createdAt, updatedAt, deleted,
//   recipes: { "<recipe id>": { title, servings, at } },
//   items:   { "<key>": { name, amount, unit, partial, section,
//                         sources: ["Ragu"], checked, removed, at } } }
// "recipes" and "items" are maps of timestamped entries, so a tick on
// one phone and an added recipe on the other both survive a sync.

import { AMOUNT, parseAmount, formatAmount } from "./scale.js";
import { ingredientLines } from "./sections.js";

export const SECTIONS = ["Produce", "Meat & fish", "Dairy & eggs", "Bakery", "Pantry", "Other", "Check you have"];

const UNITS = "kg|g|mg|ml|cl|dl|l|tbsp|tsp|cups?|tins?|cans?|jars?|pinch(?:es)?|handfuls?|bunch(?:es)?|sprigs?|slices?|packs?";
const LEADING = new RegExp(
  "^(?:~\\s*)?(" + AMOUNT + ")(?:\\s*[-–]\\s*(" + AMOUNT + "))?\\s*(" + UNITS + ")?\\b\\.?\\s*(?:of\\s+)?(.*)$",
  "i"
);
// Unit words written without a number: "handful fresh parsley", "pinch salt".
const LEADING_UNIT_ONLY = /^(handful|pinch|bunch|small bunch|splash|drizzle)\s+(?:of\s+)?(.*)$/i;

// "300 g beef mince" → { amount: 300, unit: "g", name: "beef mince" }
// "salt & pepper"    → { amount: null, unit: "", name: "salt & pepper" }
// Ranges ("2–3 cloves") count as the larger number, so you buy enough.
export function parseIngredient(line) {
  const text = line
    .replace(/\*\*|__/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const match = text.match(LEADING);
  if (match && match[4]) {
    const low = parseAmount(match[1]);
    const high = match[2] ? parseAmount(match[2]) : low;
    return {
      amount: Number.isFinite(high) ? high : null,
      unit: normaliseUnit(match[3] || ""),
      name: match[4].trim(),
    };
  }
  const unitOnly = text.match(LEADING_UNIT_ONLY);
  if (unitOnly) {
    return { amount: null, unit: unitOnly[1].toLowerCase(), name: unitOnly[2].trim() };
  }
  return { amount: null, unit: "", name: text };
}

function normaliseUnit(unit) {
  const u = unit.toLowerCase();
  const plurals = { cups: "cup", tins: "tin", cans: "tin", can: "tin", jars: "jar", pinches: "pinch",
    handfuls: "handful", bunches: "bunch", sprigs: "sprig", slices: "slice", packs: "pack" };
  return plurals[u] || u;
}

// A short, stable name for adding up: "Fresh parsley, chopped" and
// "parsley" are the same thing on a shopping list.
export function nameKey(name) {
  let key = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .split(/,| to serve| for frying| for serving| to taste/)[0]
    .replace(/\b(large|medium|small|fresh|ripe|good|about|approx\.?|of)\b/g, " ")
    .replace(/[^a-zäöüõßéè&' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Simple plurals: tomatoes → tomato, peppers → pepper (not "couscous").
  key = key
    .split(" ")
    .map(function (word) {
      if (/(tomato|potato)es$/.test(word)) {
        return word.slice(0, -2);
      }
      if (word.length > 3 && /[^su]s$/.test(word)) {
        return word.slice(0, -1);
      }
      return word;
    })
    .join(" ");
  return key;
}

const SPICES = /\b(cumin|paprika|cinnamon|turmeric|chil+i flakes|nutmeg|oregano|garam masala|bay lea(f|ves)|saffron|dried \w+|ground \w+|curry powder|allspice|cayenne|coriander seeds|cumin seeds|mustard seeds|fennel seeds|za'atar|sumac)\b/;
const RULES = [
  ["Check you have", /\b(salt|black pepper|olive oil|neutral oil|vegetable oil|sunflower oil|rapeseed oil|sesame oil|cooking oil)\b|^oil$|^pepper$|^water$/],
  ["Pantry", /\b(tins?|tinned|canned|jar|stock|passata|chopped tomatoes|tomato paste|tomato purée|coconut milk)\b/],
  ["Meat & fish", /\b(chicken|beef|lamb|pork|mince|chorizo|bacon|pancetta|sausages?|ham|turkey|duck|salmon|trout|mackerel|sea bass|cod|hake|prawns?|shrimps?|fish|herring|sardines?|sprats?|tuna|anchov(y|ies)|mussels?|squid)\b/],
  ["Dairy & eggs", /\b(eggs?|egg yolks?|milk|butter|cream|crème fraîche|creme fraiche|yogh?urt|cheese|feta|halloumi|ricotta|parmesan|mozzarella|paneer|mascarpone|quark|skyr|cheddar|gruyère|pecorino|pastry)\b/],
  ["Bakery", /\b(bread|flatbreads?|tortillas?|wraps?|pitta|pita|naan|buns?|rolls?|baguette|sourdough|ciabatta)\b/],
  ["Produce", /\b(onions?|shallots?|garlic|peppers?|tomato(es)?|courgettes?|zucchini|aubergines?|eggplant|potato(es)?|sweet potato(es)?|spinach|kale|lettuce|leaves|salad|rocket|cucumbers?|lemons?|limes?|oranges?|apples?|avocados?|cabbage|carrots?|mushrooms?|squash|pumpkin|green beans|beans?prouts|broccoli|cauliflower|leeks?|celery|ginger|spring onions?|chil+i(es)?|parsley|coriander|cilantro|dill|mint|basil|thyme|rosemary|chives|sage|herbs?|asparagus|peas|edamame|corn|beetroot|fennel|radish(es)?|pak choi|bok choy|lemongrass)\b/],
  ["Pantry", /\b(rice|pasta|spaghetti|penne|pappardelle|conchiglioni|shells|noodles?|soba|orzo|couscous|bulgur|polenta|quinoa|oats|flour|lentils?|chickpeas?|beans|black beans|cannellini|soy sauce|sauce|vinegar|honey|mustard|tahini|harissa|miso|wine|sugar|nuts|almonds|walnuts|pine nuts|seeds|capers|olives|preserved lemon|breadcrumbs|panko|maple|syrup|cocoa|chocolate|yeast|baking)\b/],
];

// Which part of the shop an ingredient is in.
export function sectionFor(parsed) {
  const name = parsed.name.toLowerCase();
  // Spices in teaspoons or pinches: you probably have them already.
  if (SPICES.test(name) && (["tsp", "pinch", ""].includes(parsed.unit))) {
    return "Check you have";
  }
  if (["tin", "jar"].includes(parsed.unit)) {
    return "Pantry";
  }
  for (const [section, pattern] of RULES) {
    if (pattern.test(name)) {
      return section;
    }
  }
  return "Other";
}

// Ingredients whose amounts only add up if the unit matches.
export function itemKey(parsed) {
  return nameKey(parsed.name) + "|" + parsed.unit;
}

// Vague amounts ("handful parsley", "pinch salt") count as "no amount".
const VAGUE_UNITS = ["handful", "pinch", "bunch", "small bunch", "splash", "drizzle"];

// Name shown on the list: without "to serve", "(~400g)" and the like.
function displayName(name) {
  const cleaned = name
    .replace(/\s*\(~?\s*\d[^)]*\)\s*$/, "")
    .replace(/\s+(to serve|for serving|to taste|for frying)\b.*$/i, "")
    .trim();
  return cleaned || name;
}

// Finds the item to add to. An ingredient without an amount ("olive oil")
// joins the same ingredient with any unit ("2 tbsp olive oil"), and the
// other way round.
function findExisting(items, parsed) {
  const exact = itemKey(parsed);
  if (items[exact] && !items[exact].removed) {
    return exact;
  }
  const name = nameKey(parsed.name);
  for (const [key, item] of Object.entries(items)) {
    if (item.removed || nameKey(item.name) !== name) {
      continue;
    }
    if (parsed.amount === null || item.amount === null) {
      return key;
    }
  }
  return null;
}

// Adds one recipe's ingredients to a list's items. factor scales amounts
// (2 = double). Returns a new items map; the old one is not changed.
export function addRecipeItems(items, recipe, factor, now) {
  const result = Object.assign({}, items);
  for (const line of ingredientLines(recipe.text)) {
    const parsed = parseIngredient(line);
    if (!parsed.name) {
      continue;
    }
    if (parsed.amount === null && VAGUE_UNITS.includes(parsed.unit)) {
      parsed.unit = "";
    }
    const amount = parsed.amount === null ? null : parsed.amount * factor;
    const existingKey = findExisting(result, parsed);
    const existing = existingKey ? result[existingKey] : null;
    const key = existingKey || itemKey(parsed);

    if (existing) {
      const sources = existing.sources.includes(recipe.title) ? existing.sources : existing.sources.concat(recipe.title);
      result[key] = Object.assign({}, existing, {
        amount: sumAmounts(existing.amount, amount),
        // Keep the unit of whichever has an amount.
        unit: existing.amount === null && amount !== null ? parsed.unit : existing.unit,
        // "partial": some of it had no amount ("lemon" + "1 lemon").
        partial: existing.partial || (existing.amount === null) !== (amount === null),
        sources: sources,
        checked: false,
        at: now,
      });
    } else {
      result[key] = {
        name: displayName(parsed.name),
        amount: amount,
        unit: parsed.unit,
        partial: false,
        section: sectionFor(parsed),
        sources: [recipe.title],
        checked: false,
        removed: false,
        at: now,
      };
    }
  }
  return result;
}

function sumAmounts(a, b) {
  if (a === null) {
    return b;
  }
  if (b === null) {
    return a;
  }
  return a + b;
}

// An item you typed yourself, e.g. "toilet paper" or "2 lemons".
export function manualItem(text, now) {
  const parsed = parseIngredient(text);
  return {
    key: itemKey(parsed),
    item: {
      name: parsed.name,
      amount: parsed.amount,
      unit: parsed.unit,
      partial: false,
      section: sectionFor(parsed),
      sources: [],
      checked: false,
      removed: false,
      at: now,
    },
  };
}

// "500 g halloumi", "2 tbsp tahini", "3 red peppers", "Salt & pepper"
export function itemLabel(item) {
  if (item.amount === null) {
    const unit = item.unit ? item.unit + " " : "";
    return capitalise(unit + item.name);
  }
  const amount = formatAmount(item.amount) + (item.partial ? "+" : "");
  return amount + " " + (item.unit ? item.unit + " " : "") + item.name;
}

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Items grouped by section in shop order; unticked first, then A–Z.
export function groupBySection(items) {
  const groups = [];
  for (const section of SECTIONS) {
    const entries = Object.entries(items || {})
      .filter(([, item]) => !item.removed && item.section === section)
      .sort(function ([, a], [, b]) {
        if (a.checked !== b.checked) {
          return a.checked ? 1 : -1;
        }
        return nameKey(a.name).localeCompare(nameKey(b.name));
      })
      .map(([key, item]) => ({ key: key, item: item }));
    if (entries.length) {
      groups.push({ section: section, entries: entries });
    }
  }
  return groups;
}

export function progress(items) {
  const visible = Object.values(items || {}).filter((item) => !item.removed);
  return { done: visible.filter((item) => item.checked).length, total: visible.length };
}

// ---------- Merging lists from two phones ----------

function mergeTimestamped(a, b) {
  const result = Object.assign({}, a || {});
  for (const [key, entry] of Object.entries(b || {})) {
    if (!result[key] || entry.at > result[key].at) {
      result[key] = entry;
    }
  }
  return result;
}

// Same rules as the Sheet script: newest list wins, but recipes and
// items are merged entry by entry.
export function mergeLists(listA, listB) {
  const byId = new Map();
  for (const list of [...listA, ...listB]) {
    const existing = byId.get(list.id);
    if (!existing) {
      byId.set(list.id, list);
      continue;
    }
    const winner = list.updatedAt > existing.updatedAt ? list : existing;
    if (winner.deleted) {
      byId.set(list.id, winner);
      continue;
    }
    byId.set(list.id, Object.assign({}, winner, {
      recipes: mergeTimestamped(existing.recipes, list.recipes),
      items: mergeTimestamped(existing.items, list.items),
    }));
  }
  return [...byId.values()];
}

// The list in use: the newest one that isn't deleted.
export function currentList(lists) {
  return lists
    .filter((list) => !list.deleted)
    .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
}

export function normaliseList(raw) {
  if (!raw || typeof raw.id !== "string") {
    return null;
  }
  return {
    id: raw.id,
    createdAt: Number(raw.createdAt) || 0,
    updatedAt: Number(raw.updatedAt) || 0,
    deleted: raw.deleted === true,
    recipes: raw.recipes && typeof raw.recipes === "object" ? raw.recipes : {},
    items: raw.items && typeof raw.items === "object" ? raw.items : {},
  };
}
