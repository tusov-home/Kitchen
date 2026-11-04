// Unit tests for pantry and chores helpers. Run with: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  guessSection, nextStatus, normalisePantryItem, groupPantry, lowOrOut, pantryCovers, findInPantry,
} from "../js/lib/pantry.js";
import {
  addInterval, nextDue, dueLabel, repeatLabel, repeatKey, groupChores, dueNowCount, normaliseChore,
} from "../js/lib/chores.js";

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

// ---------- Chores ----------

test("intervals: days, weeks, months (month ends kept sensible)", () => {
  assert.equal(addInterval("2026-11-04", { every: 1, unit: "day" }), "2026-11-05");
  assert.equal(addInterval("2026-11-04", { every: 2, unit: "week" }), "2026-11-18");
  assert.equal(addInterval("2026-12-28", { every: 1, unit: "week" }), "2027-01-04");
  assert.equal(addInterval("2026-01-31", { every: 1, unit: "month" }), "2026-02-28");
  assert.equal(addInterval("2028-01-31", { every: 1, unit: "month" }), "2028-02-29");
  assert.equal(addInterval("2026-11-15", { every: 3, unit: "month" }), "2027-02-15");
});

test("a repeating chore keeps its rhythm when done a bit late", () => {
  const weekly = { repeat: { every: 1, unit: "week" }, due: "2026-11-01" }; // Sunday
  assert.equal(nextDue(weekly, "2026-11-01"), "2026-11-08", "on time");
  assert.equal(nextDue(weekly, "2026-11-03"), "2026-11-08", "2 days late: still next Sunday");
  assert.equal(nextDue(weekly, "2026-11-10"), "2026-11-17", "very late: a week from today");
  assert.equal(nextDue({ repeat: { every: 1, unit: "week" }, due: "2026-11-08" }, "2026-11-04"), "2026-11-11", "done early: from today");
  assert.equal(nextDue({ repeat: { every: 2, unit: "week" }, due: null }, "2026-11-04"), "2026-11-18", "no date yet");
  assert.equal(nextDue({ repeat: null, due: "2026-11-04" }, "2026-11-04"), null, "one-off");
});

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

test("repeat labels and menu keys", () => {
  assert.equal(repeatLabel(null), "Once");
  assert.equal(repeatLabel({ every: 1, unit: "week" }), "Every week");
  assert.equal(repeatLabel({ every: 2, unit: "week" }), "Every 2 weeks");
  assert.equal(repeatKey({ every: 2, unit: "week" }), "2-week");
  assert.equal(repeatKey({ every: 10, unit: "day" }), "custom");
  assert.equal(repeatKey(null), "once");
});

test("chores are grouped by when they're due, and filtered by person", () => {
  const today = "2026-11-04";
  const list = [
    { id: "1", title: "Bins", who: "Tõnis", due: "2026-11-02", done: false },
    { id: "2", title: "Vacuum", who: "", due: "2026-11-04", done: false },
    { id: "3", title: "Windows", who: "Kristiina", due: "2026-11-08", done: false },
    { id: "4", title: "Descale kettle", who: "", due: "2026-12-01", done: false },
    { id: "5", title: "Fix shelf", who: "Tõnis", due: null, done: false },
    { id: "6", title: "Call landlord", who: "", due: null, done: true },
  ];
  const groups = groupChores(list, today, "");
  assert.deepEqual(groups.map((g) => g.group), ["Late", "Today", "This week", "Later", "Any time", "Done"]);
  const kristiina = groupChores(list, today, "Kristiina").flatMap((g) => g.chores.map((c) => c.title));
  assert.deepEqual(kristiina, ["Vacuum", "Windows", "Descale kettle", "Call landlord"]);
  assert.equal(dueNowCount(list, today, ""), 2);
  assert.equal(dueNowCount(list, today, "Kristiina"), 1);
});

test("chores from the Sheet are cleaned up", () => {
  const c = normaliseChore({ id: "x", title: "Bins", repeat: { every: "2", unit: "week" }, due: "2026-11-04", done: true });
  assert.deepEqual(c.repeat, { every: 2, unit: "week" });
  assert.equal(c.done, false, "repeating chores are never 'done'");
  assert.equal(normaliseChore({ id: "y", repeat: { every: 0, unit: "week" } }).repeat, null);
  assert.equal(normaliseChore({ id: "z", due: "next week" }).due, null);
});
