// The pantry: what you have at home. Uses the shared collection store
// and syncs through the Sheet's "pantry" tab.
import { createCollection } from "./collection.js";
import {
  normalisePantryItem, guessSection, nextStatus, nameKeyOf, STAPLES, OTHER_SECTION,
  normaliseSection, effectiveSections, sectionNameProblem, reorderSections,
} from "./lib/pantry.js";

export const pantry = createCollection("pantry", normalisePantryItem);
// The categories, shared between phones through their own Sheet tab.
export const pantrySections = createCollection("pantry-sections", normaliseSection);

export function getSections() {
  return effectiveSections(pantrySections.getAllForSync());
}

export function sectionNames() {
  return getSections().map((section) => section.title);
}

export function itemsInSection(title) {
  return pantry.getAll().filter((item) => item.section === title).length;
}

// These return what's wrong with the name, or "" when it worked.
export function addSection(name) {
  const sections = getSections();
  const problem = sectionNameProblem(sections, name, null);
  if (problem) {
    return problem;
  }
  // Just above "Other".
  const last = sections[sections.length - 2];
  pantrySections.put({ title: name.trim(), order: last ? last.order + 10 : 0 });
  return "";
}

export function renameSection(id, name) {
  const sections = getSections();
  const section = sections.find((entry) => entry.id === id);
  const problem = sectionNameProblem(sections, name, id);
  if (!section || problem) {
    return problem;
  }
  const title = name.trim();
  if (title === section.title) {
    return "";
  }
  pantrySections.put({ id: id, title: title, order: section.order });
  // Items hold the category's name, so they follow it.
  for (const item of pantry.getAll().filter((entry) => entry.section === section.title)) {
    pantry.update(item.id, { section: title });
  }
  return "";
}

// Its items move to "Other".
export function removeSection(id) {
  const section = getSections().find((entry) => entry.id === id);
  if (!section || section.title === OTHER_SECTION) {
    return;
  }
  pantrySections.put({ id: id, title: section.title, order: section.order, hidden: true });
  for (const item of pantry.getAll().filter((entry) => entry.section === section.title)) {
    pantry.update(item.id, { section: OTHER_SECTION });
  }
}

// direction: -1 up, +1 down.
export function moveSection(id, direction) {
  const sections = getSections().filter((section) => section.title !== OTHER_SECTION);
  const reordered = reorderSections(sections, id, direction);
  if (reordered === sections) {
    return;
  }
  for (const section of reordered) {
    pantrySections.put({ id: section.id, title: section.title, order: section.order });
  }
}

// The guess, if that category still exists.
function likelySection(title) {
  const guess = guessSection(title);
  return sectionNames().includes(guess) ? guess : OTHER_SECTION;
}

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
  return pantry.put({ title: clean, section: section || likelySection(clean), status: "have" });
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
  const names = sectionNames();
  for (const [title, section] of STAPLES) {
    const before = pantry.getAll().length;
    addItem(title, names.includes(section) ? section : OTHER_SECTION);
    if (pantry.getAll().length > before) {
      added++;
    }
  }
  return added;
}
