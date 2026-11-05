// Pure helpers for the daily suggestion on the recipes page. No DOM.
//
// The same day gives the same order on both phones (it depends only on
// the date and the synced recipes), and it changes from day to day.
// It prefers dishes you rated well and haven't cooked lately, and
// weekend dishes on weekends.

import { averageRating } from "./recipes.js";
import { daysBetween } from "./chores.js";

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

// The latest "Cooked 12 Nov 2026" in a recipe's notes, as "2026-11-12".
export function lastCooked(notes) {
  let latest = null;
  const pattern = /cooked\s+(\d{1,2})\s+([a-z]{3,4})\w*\s+(\d{4})/gi;
  let match;
  while ((match = pattern.exec(notes || "")) !== null) {
    const month = MONTHS[match[2].toLowerCase()];
    if (!month) {
      continue;
    }
    const date = match[3] + "-" + String(month).padStart(2, "0") + "-" + match[1].padStart(2, "0");
    if (!latest || date > latest) {
      latest = date;
    }
  }
  return latest;
}

// A number from 0 to 1 that is always the same for the same text.
export function seededRandom(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function isWeekendDay(today) {
  const [y, m, d] = today.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
}

// All recipes in suggestion order for a day: [{ recipe, reason }].
export function dailySuggestions(recipes, today) {
  const weekend = isWeekendDay(today);
  const scored = recipes.map(function (recipe) {
    const rating = averageRating(recipe);
    const cooked = lastCooked(recipe.notes);
    const daysAgo = cooked ? daysBetween(cooked, today) : null;
    const weekendDish = (recipe.tags || []).includes("weekend");

    let score = rating === null ? 3 : rating;
    if (daysAgo !== null && daysAgo < 7) {
      score -= 3; // just had it
    } else if (daysAgo === null || daysAgo >= 21) {
      score += 1;
    }
    if (weekendDish && weekend) {
      score += 1;
    } else if (weekendDish && !weekend) {
      score -= 1; // long cooks are for weekends
    }
    score += seededRandom(today + "|" + recipe.id) * 1.5;

    // Why this one, in a few words.
    const reasons = [];
    if (weekendDish && weekend) {
      reasons.push("Something for the weekend");
    }
    if (rating !== null && rating >= 4.5) {
      reasons.push("A favourite, rated " + (Math.round(rating * 10) / 10) + " ★");
    } else if (rating !== null && rating >= 4) {
      reasons.push("Rated " + (Math.round(rating * 10) / 10) + " ★");
    }
    if (daysAgo !== null && daysAgo >= 21) {
      reasons.push("Not cooked in a while");
    } else if (daysAgo === null && reasons.length < 2) {
      reasons.push("Not cooked yet");
    }
    return { recipe: recipe, reason: reasons.slice(0, 2).join(" · "), score: score };
  });
  scored.sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title));
  return scored.map(({ recipe, reason }) => ({ recipe: recipe, reason: reason }));
}

// Whose recipes the suggestion picks from. Uses the saved choice, or else
// just this phone's owner, or everyone if this phone's owner has no recipes.
export function activeOwners(owners, saved, myName) {
  const kept = (saved || []).filter((owner) => owners.includes(owner));
  if (kept.length > 0) {
    return kept;
  }
  return owners.includes(myName) ? [myName] : owners;
}

// Switches one owner on or off; the last one always stays on.
export function toggleOwner(active, owner) {
  if (!active.includes(owner)) {
    return [...active, owner];
  }
  return active.length > 1 ? active.filter((name) => name !== owner) : active;
}

// Recipes of the chosen owners. Old recipes without an owner always count.
export function recipesOfOwners(recipes, active) {
  return recipes.filter((recipe) => !recipe.owner || active.includes(recipe.owner));
}

// "Tõnis" gives "T".
export function initial(name) {
  return ([...name.trim()][0] || "").toUpperCase();
}
