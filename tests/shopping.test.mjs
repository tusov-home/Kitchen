// Unit tests for the shopping list helpers. Run with: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseIngredient, nameKey, sectionFor, addRecipeItems, manualItem, itemLabel,
  groupBySection, progress, mergeLists, currentList, undoAdded,
} from "../js/lib/shopping.js";
import { ingredientLines } from "../js/lib/sections.js";

test("ingredient lines come only from the ingredients part", () => {
  const text = "# Ragu\n\nServes 2\n\n## Ingredients\n- 400 g beef\n### Sauce\n- 1 tin tomatoes\n\n## Method\n1. Brown 400 g beef.";
  assert.deepEqual(ingredientLines(text), ["400 g beef", "1 tin tomatoes"]);
  assert.deepEqual(ingredientLines("- 2 onions\n\n1. Fry 2 onions"), ["2 onions"]);
});

test("amount, unit and name are read from a line", () => {
  assert.deepEqual(parseIngredient("300 g beef mince"), { amount: 300, unit: "g", name: "beef mince" });
  assert.deepEqual(parseIngredient("600g chicken"), { amount: 600, unit: "g", name: "chicken" });
  assert.deepEqual(parseIngredient("1½ tbsp miso"), { amount: 1.5, unit: "tbsp", name: "miso" });
  assert.deepEqual(parseIngredient("2–3 garlic cloves"), { amount: 3, unit: "", name: "garlic cloves" });
  assert.deepEqual(parseIngredient("1 tin chickpeas (400g), drained"), { amount: 1, unit: "tin", name: "chickpeas (400g), drained" });
  assert.deepEqual(parseIngredient("salt & pepper"), { amount: null, unit: "", name: "salt & pepper" });
  assert.deepEqual(parseIngredient("handful fresh parsley"), { amount: null, unit: "handful", name: "fresh parsley" });
});

test("names are simplified for adding up", () => {
  assert.equal(nameKey("Fresh parsley, chopped"), "parsley");
  assert.equal(nameKey("ripe tomatoes"), "tomato");
  assert.equal(nameKey("red peppers"), "red pepper");
  assert.equal(nameKey("couscous"), "couscous");
  assert.equal(nameKey("lemon to serve"), "lemon");
});

test("ingredients go to the right shop section", () => {
  const s = (line) => sectionFor(parseIngredient(line));
  assert.equal(s("2 red peppers"), "Produce");
  assert.equal(s("salt & pepper"), "Check you have");
  assert.equal(s("1 tsp smoked paprika"), "Check you have");
  assert.equal(s("2 tbsp olive oil"), "Check you have");
  assert.equal(s("400 g beef mince"), "Meat & fish");
  assert.equal(s("4 mackerel fillets"), "Meat & fish");
  assert.equal(s("4 eggs"), "Dairy & eggs");
  assert.equal(s("100 g feta"), "Dairy & eggs");
  assert.equal(s("4 flatbreads"), "Bakery");
  assert.equal(s("1 tin chopped tomatoes"), "Pantry");
  assert.equal(s("200 ml chicken stock"), "Pantry");
  assert.equal(s("300 g brown rice"), "Pantry");
  assert.equal(s("fresh coriander"), "Produce");
  assert.equal(s("toilet paper"), "Other");
});

const ragu = { title: "Ragu", text: "## Ingredients\n- 400 g beef mince\n- 2 onions\n- olive oil\n- 1 tin tomatoes (400 g)" };
const peppers = { title: "Peppers", text: "## Ingredients\n- 400g beef mince\n- 1 onion\n- 2 tbsp olive oil\n- handful parsley" };

test("the same ingredient from two recipes is added up", () => {
  let items = addRecipeItems({}, ragu, 1, 1);
  items = addRecipeItems(items, peppers, 1, 2);
  const labels = Object.values(items).map(itemLabel).sort();
  assert.deepEqual(labels, [
    "1 tin tomatoes", "2+ tbsp olive oil", "3 onions", "800 g beef mince", "Parsley",
  ].sort());
  const beef = Object.values(items).find((i) => i.name === "beef mince");
  assert.deepEqual(beef.sources, ["Ragu", "Peppers"]);
});

test("servings factor scales the amounts", () => {
  const items = addRecipeItems({}, ragu, 2, 1);
  assert.ok(Object.values(items).some((i) => itemLabel(i) === "800 g beef mince"));
  assert.ok(Object.values(items).some((i) => itemLabel(i) === "4 onions"));
});

test("own items and grouping in shop order", () => {
  let items = addRecipeItems({}, ragu, 1, 1);
  const own = manualItem("toilet paper", 2);
  items[own.key] = own.item;
  const beefKey = Object.keys(items).find((k) => k.startsWith("beef"));
  items[beefKey] = Object.assign({}, items[beefKey], { checked: true });
  const groups = groupBySection(items);
  assert.deepEqual(groups.map((g) => g.section), ["Produce", "Meat & fish", "Pantry", "Other", "Check you have"]);
  assert.deepEqual(progress(items), { done: 1, total: 5 });
});

test("lists from two phones merge item by item", () => {
  const base = { id: "L1", createdAt: 1, updatedAt: 1, deleted: false, recipes: {}, items: {
    "onion|": { name: "onion", checked: false, at: 1 },
    "beef mince|g": { name: "beef mince", checked: false, at: 1 },
  } };
  const phoneA = Object.assign({}, base, { updatedAt: 3, items: Object.assign({}, base.items, { "onion|": { name: "onion", checked: true, at: 3 } }) });
  const phoneB = Object.assign({}, base, { updatedAt: 2, items: Object.assign({}, base.items, { "beef mince|g": { name: "beef mince", checked: true, at: 2 } }) });
  const merged = mergeLists([phoneA], [phoneB])[0];
  assert.equal(merged.items["onion|"].checked, true);
  assert.equal(merged.items["beef mince|g"].checked, true);
});

test("the current list is the newest one not deleted", () => {
  const lists = [
    { id: "a", createdAt: 1, deleted: false },
    { id: "b", createdAt: 3, deleted: true },
    { id: "c", createdAt: 2, deleted: false },
  ];
  assert.equal(currentList(lists).id, "c");
  assert.equal(currentList([]), null);
});

test("undoing an addition restores amounts and marks new items removed", () => {
  const onion = { name: "onion", amount: 1, at: 100 };
  const bread = { name: "bread", at: 100 };
  const before = { onion: onion, bread: bread };
  const after = { onion: { name: "onion", amount: 3, at: 200 }, bread: bread, salt: { name: "salt", at: 200 } };
  const undone = undoAdded(before, after, 300);
  assert.equal(undone.onion.amount, 1);
  assert.equal(undone.onion.at, 300);
  assert.equal(undone.bread, bread);
  assert.equal(undone.salt.removed, true);
  assert.equal(undone.salt.at, 300);
});
