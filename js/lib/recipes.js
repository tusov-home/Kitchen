// Pure helpers for recipes: no DOM, no storage. Easy to test.
//
// A recipe looks like:
// { id, title, text, tags: ["quick"], notes, servings: 2,
//   owner: "Kadi", copyOf: "<id of the recipe it was copied from>" or "",
//   ratings: { "Tõnis": { stars: 4, at: 1730000000000 } },
//   updatedAt: 1730000000000, deleted: false }

export function newId() {
  if (globalThis.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Removes markdown decoration (#, **, *, _) around a line of text.
function cleanLine(line) {
  return line
    .replace(/^#+\s*/, "")
    .replace(/^[*_]+|[*_]+$/g, "")
    .replace(/^recipe:\s*/i, "")
    .trim();
}

// The first non-empty line of pasted text becomes the title.
export function titleFromText(text) {
  const lines = (text || "").split("\n");
  for (const line of lines) {
    const cleaned = cleanLine(line);
    if (cleaned) {
      return cleaned.slice(0, 120);
    }
  }
  return "";
}

// If the text starts with the title line, drop that line so the
// title isn't shown twice when viewing the recipe.
export function bodyWithoutTitle(text, title) {
  const lines = (text || "").split("\n");
  let index = 0;
  while (index < lines.length && lines[index].trim() === "") {
    index++;
  }
  if (index < lines.length && cleanLine(lines[index]) === title) {
    return lines.slice(index + 1).join("\n").trim();
  }
  return (text || "").trim();
}

// "Quick, weekend,  quick" -> ["quick", "weekend"]
export function parseTags(input) {
  const tags = [];
  for (const part of (input || "").split(",")) {
    const tag = part.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      tags.push(tag);
    }
  }
  return tags;
}

// All tags in use, sorted alphabetically.
export function allTags(recipes) {
  const set = new Set();
  for (const recipe of recipes) {
    for (const tag of recipe.tags || []) {
      set.add(tag);
    }
  }
  return [...set].sort();
}

// Recipes to show in the list: filtered by search text and tag,
// title matches first, then most recently changed.
export function visibleRecipes(recipes, query, tag) {
  const q = (query || "").trim().toLowerCase();
  const result = [];

  for (const recipe of recipes) {
    if (recipe.deleted) {
      continue;
    }
    if (tag && !(recipe.tags || []).includes(tag)) {
      continue;
    }
    const inTitle = recipe.title.toLowerCase().includes(q);
    const inTags = (recipe.tags || []).some((t) => t.includes(q));
    const inText = recipe.text.toLowerCase().includes(q);
    if (q && !inTitle && !inTags && !inText) {
      continue;
    }
    result.push({ recipe: recipe, score: inTitle ? 2 : inTags ? 1 : 0 });
  }

  result.sort(function (a, b) {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return b.recipe.updatedAt - a.recipe.updatedAt;
  });

  return result.map((item) => item.recipe);
}

// Combines two people's-ratings objects: for each person, their most
// recent rating wins. So two phones rating at the same time both count.
export function mergeRatings(a, b) {
  const result = Object.assign({}, a || {});
  for (const [name, rating] of Object.entries(b || {})) {
    if (!result[name] || rating.at > result[name].at) {
      result[name] = rating;
    }
  }
  return result;
}

// Combines two lists of recipes. For the same id, the most recently
// changed version wins ("last write wins"); ratings are combined person
// by person. Deleted recipes are kept as small markers so the deletion
// reaches the other phone too.
export function mergeRecipes(listA, listB) {
  const byId = new Map();
  for (const recipe of [...listA, ...listB]) {
    const existing = byId.get(recipe.id);
    if (!existing) {
      byId.set(recipe.id, recipe);
      continue;
    }
    const winner = recipe.updatedAt > existing.updatedAt ? recipe : existing;
    const ratings = winner.deleted ? {} : mergeRatings(existing.ratings, recipe.ratings);
    byId.set(recipe.id, Object.assign({}, winner, { ratings: ratings }));
  }
  return [...byId.values()];
}

// Only the owner may change a recipe. Recipes from before owners
// existed (no owner) can be changed by anyone.
export function canEdit(recipe, myName) {
  return !recipe.owner || recipe.owner === myName;
}

// The starting point for "Make my copy": same recipe, new owner,
// empty notes and ratings, and a link back to the original.
export function copyForEditing(recipe) {
  return {
    title: recipe.title,
    // Without the title line, so renaming the copy doesn't leave the
    // old title behind inside the text.
    text: bodyWithoutTitle(recipe.text, recipe.title),
    tags: recipe.tags.slice(),
    servings: recipe.servings,
    notes: "",
    copyOf: recipe.id,
  };
}

// Average stars of everyone who rated, or null if nobody has.
export function averageRating(recipe) {
  const stars = Object.values(recipe.ratings || {})
    .map((r) => r.stars)
    .filter((s) => s >= 1 && s <= 5);
  if (!stars.length) {
    return null;
  }
  return stars.reduce((sum, s) => sum + s, 0) / stars.length;
}

// Ratings sorted by name, without cleared ones (stars 0).
export function ratingList(recipe) {
  return Object.entries(recipe.ratings || {})
    .filter(([, r]) => r.stars >= 1)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, r]) => ({ name: name, stars: r.stars }));
}

// "Cooked 12 Nov 2026" for the notes.
export function cookedNote(date) {
  const formatted = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return "Cooked " + formatted;
}

// Makes sure data from a file or the Sheet has the right shape.
export function normaliseRecipe(raw) {
  if (!raw || typeof raw.id !== "string" || !raw.id) {
    return null;
  }
  let tags = raw.tags;
  if (typeof tags === "string") {
    tags = parseTags(tags);
  }
  let ratings = raw.ratings;
  if (typeof ratings === "string") {
    try {
      ratings = JSON.parse(ratings || "{}");
    } catch (error) {
      ratings = {};
    }
  }
  const cleanRatings = {};
  for (const [name, r] of Object.entries(ratings && typeof ratings === "object" ? ratings : {})) {
    const stars = Number(r && r.stars);
    if (name && stars >= 0 && stars <= 5) {
      cleanRatings[name] = { stars: Math.round(stars), at: Number(r.at) || 0 };
    }
  }
  const servings = Number(raw.servings);
  return {
    id: raw.id,
    title: String(raw.title || ""),
    text: String(raw.text || ""),
    tags: Array.isArray(tags) ? tags.map(String) : [],
    notes: String(raw.notes || ""),
    servings: servings >= 1 && servings <= 50 ? Math.round(servings) : null,
    ratings: cleanRatings,
    owner: String(raw.owner || ""),
    copyOf: String(raw.copyOf || ""),
    updatedAt: Number(raw.updatedAt) || 0,
    deleted: raw.deleted === true || raw.deleted === "TRUE" || raw.deleted === "true",
  };
}
