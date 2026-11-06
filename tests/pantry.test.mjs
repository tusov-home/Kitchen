// Unit tests for pantry and date helpers. Run with: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  guessSection, nextStatus, normalisePantryItem, groupPantry, lowOrOut, pantryCovers, findInPantry,
} from "../js/lib/pantry.js";
import { dueLabel } from "../js/lib/dates.js";

// ---------- Pantry ----------

test("pantry sections are guessed from the name", () => {
  assert.equal(guessSection("Eggs"), "Fridge");
  assert.equal(guessSection("Frozen peas"), "Freezer");
  assert.equal(guessSection("Onions"), "Fruit & veg");
  assert.equal(guessSection("Rice"), "Cupboard");
  assert.equal(guessSection("Olive oil"), "Spices & oils");
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
  assert.deepEqual(item, { id: "a", title: "Rice", section: "Cupboard", status: "have", updatedAt: 0, deleted: false });
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
