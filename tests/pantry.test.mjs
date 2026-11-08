// Unit tests for pantry and date helpers. Run with: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  guessSection, nextStatus, normalisePantryItem, groupPantry, lowOrOut, pantryCovers, findInPantry,
  effectiveSections, defaultSectionId, sectionNameProblem, reorderSections, normaliseSection, OTHER_SECTION, searchPantry,
} from "../js/lib/pantry.js";
import { dueLabel } from "../js/lib/dates.js";

// ---------- Pantry ----------

test("pantry sections are guessed from the name", () => {
  assert.equal(guessSection("Eggs"), "Fridge");
  assert.equal(guessSection("Frozen peas"), "Freezer");
  assert.equal(guessSection("Onions"), "Fruit & veg");
  assert.equal(guessSection("Rice"), "Grains, pasta & rice");
  assert.equal(guessSection("Olive oil"), "Oils, vinegars & sauces");
  assert.equal(guessSection("Tinned tomatoes"), "Tins & jars");
  assert.equal(guessSection("Garam masala"), "Spice mixes");
  assert.equal(guessSection("Cumin"), "Spices & oils");
  assert.equal(guessSection("Dishwasher tabs"), "Other");
});

test("status cycles Have → Low → Out → Have", () => {
  assert.equal(nextStatus("have"), "low");
  assert.equal(nextStatus("low"), "out");
  assert.equal(nextStatus("out"), "have");
});

test("pantry items are cleaned up and grouped", () => {
  const item = normalisePantryItem({ id: "a", title: " Rice ", status: "weird" });
  assert.deepEqual(item, { id: "a", title: "Rice", section: "Grains, pasta & rice", status: "have", updatedAt: 0, deleted: false });
  const groups = groupPantry([
    { title: "rice", section: "Cupboard" }, { title: "Eggs", section: "Fridge" }, { title: "Flour", section: "Cupboard" },
  ]);
  assert.deepEqual(groups.map((g) => g.section), ["Fridge", "Cupboard"]);
  assert.deepEqual(groups[1].items.map((i) => i.title), ["Flour", "rice"]);
  assert.equal(lowOrOut([{ status: "have" }, { status: "low" }, { status: "out" }]).length, 2);
});

test("a pantry item covers matching ingredients", () => {
  assert.equal(pantryCovers("Rice", "brown rice (dry)"), true);
  assert.equal(pantryCovers("Olive oil", "olive oil"), true);
  assert.equal(pantryCovers("Eggs", "eggs"), true);
  assert.equal(pantryCovers("Onions", "red onion"), true);
  assert.equal(pantryCovers("Olive oil", "sesame oil"), false);
  assert.equal(pantryCovers("Rice", "rice noodles"), true); // acceptable: lands in "Check you have", not removed
  assert.equal(pantryCovers("Milk", "coconut milk"), true);
  assert.equal(pantryCovers("Coconut milk", "milk"), false);
});

test("only items you have count, not low or out", () => {
  const items = [{ title: "Rice", status: "out" }, { title: "Olive oil", status: "have" }];
  assert.equal(findInPantry(items, "300 g rice"), null);
  assert.equal(findInPantry(items, "olive oil").title, "Olive oil");
});

// ---------- Categories ----------

test("a pantry item keeps a category you made yourself", () => {
  assert.equal(normalisePantryItem({ id: "a", title: "Rice", section: "Top shelf" }).section, "Top shelf");
});

test("categories start from the defaults, with Other last", () => {
  const names = effectiveSections([]).map((s) => s.title);
  assert.equal(names[0], "Fridge");
  assert.ok(names.includes("Spice mixes"));
  assert.equal(names[names.length - 1], OTHER_SECTION);
});

test("saved categories change, hide and add to the defaults", () => {
  const fridge = defaultSectionId("Fridge");
  const freezer = defaultSectionId("Freezer");
  const stored = [
    { id: fridge, title: "Cold", order: 0 },
    { id: freezer, title: "Freezer", order: 10, hidden: true },
    { id: "x", title: "Top shelf", order: 5 },
  ];
  const names = effectiveSections(stored).map((s) => s.title);
  assert.deepEqual(names.slice(0, 2), ["Cold", "Top shelf"]);
  assert.ok(!names.includes("Fridge"));
  assert.ok(!names.includes("Freezer"));
  assert.equal(names[names.length - 1], OTHER_SECTION);
});

test("Other can't be hidden or moved by what's saved", () => {
  const other = defaultSectionId(OTHER_SECTION);
  const names = effectiveSections([{ id: other, title: OTHER_SECTION, order: -5, hidden: true }]).map((s) => s.title);
  assert.equal(names[names.length - 1], OTHER_SECTION);
});

test("a category name must be new and not empty", () => {
  const sections = effectiveSections([]);
  assert.notEqual(sectionNameProblem(sections, "  ", null), "");
  assert.notEqual(sectionNameProblem(sections, "fridge", null), "");
  assert.equal(sectionNameProblem(sections, "Fridge", defaultSectionId("Fridge")), "");
  assert.equal(sectionNameProblem(sections, "Top shelf", null), "");
});

test("moving a category swaps it with its neighbour, and stops at the ends", () => {
  const list = [{ id: "a", title: "A", order: 0 }, { id: "b", title: "B", order: 10 }];
  assert.deepEqual(reorderSections(list, "b", -1).map((s) => [s.id, s.order]), [["b", 0], ["a", 10]]);
  assert.equal(reorderSections(list, "a", -1), list);
  assert.equal(reorderSections(list, "b", 1), list);
});

test("items from a removed category show under Other", () => {
  const groups = groupPantry([{ title: "Rice", section: "Gone" }, { title: "Eggs", section: "Fridge" }], ["Fridge", OTHER_SECTION]);
  assert.deepEqual(groups.map((g) => g.section), ["Fridge", OTHER_SECTION]);
  assert.equal(groups[1].items[0].title, "Rice");
});

test("categories from the Sheet are cleaned up", () => {
  assert.equal(normaliseSection({ title: "No id" }), null);
  assert.equal(normaliseSection({ id: "a", title: " Shelf ", order: "20" }).title, "Shelf");
  assert.equal(normaliseSection({ id: "a", order: "20" }).order, 20);
});

// ---------- Dates ----------

test("due labels", () => {
  const today = "2026-11-04"; // Wednesday
  assert.equal(dueLabel("2026-11-04", today), "Today");
  assert.equal(dueLabel("2026-11-05", today), "Tomorrow");
  assert.equal(dueLabel("2026-11-03", today), "Yesterday");
  assert.equal(dueLabel("2026-11-01", today), "3 days late");
  assert.equal(dueLabel("2026-11-07", today), "Sat");
  assert.equal(dueLabel("2026-11-20", today), "20 Nov");
  assert.equal(dueLabel(null, today), "");
});

test("searchPantry: anywhere in the name, starts first, ignores case and accents", () => {
  const items = [
    { id: "1", title: "Brown rice" },
    { id: "2", title: "Rice vinegar" },
    { id: "3", title: "Crème fraîche" },
    { id: "4", title: "Oats" },
  ];
  assert.deepEqual(searchPantry(items, "RICE").map((item) => item.id), ["2", "1"]);
  assert.deepEqual(searchPantry(items, "creme").map((item) => item.id), ["3"]);
  assert.deepEqual(searchPantry(items, "  "), []);
  assert.deepEqual(searchPantry(items, "zz"), []);
});
