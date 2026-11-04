// The pantry: what you have at home. Uses the shared collection store
// and syncs through the Sheet's "pantry" tab.
import { createCollection } from "./collection.js";
import { normalisePantryItem, guessSection, nextStatus, nameKeyOf, STAPLES } from "./lib/pantry.js";

export const pantry = createCollection("pantry", normalisePantryItem);

// Adds an item, or returns the existing one with the same name.
export function addItem(title, section) {
  const clean = title.trim();
  if (!clean) {
    return null;
  }
  const existing = pantry.getAll().find((item) => nameKeyOf(item.title) === nameKeyOf(clean));
  if (existing) {
    return existing;
  }
  return pantry.put({ title: clean, section: section || guessSection(clean), status: "have" });
}

export function cycleStatus(id) {
  const item = pantry.get(id);
  return item ? pantry.update(id, { status: nextStatus(item.status) }) : null;
}

export function setStatus(id, status) {
  return pantry.update(id, { status: status });
}

// Adds the common staples you don't have on the list yet.
export function addStaples() {
  let added = 0;
  for (const [title, section] of STAPLES) {
    const before = pantry.getAll().length;
    addItem(title, section);
    if (pantry.getAll().length > before) {
      added++;
    }
  }
  return added;
}
