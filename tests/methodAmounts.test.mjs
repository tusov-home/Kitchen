import test from "node:test";
import assert from "node:assert/strict";
import { ingredientRefs, addAmounts } from "../js/lib/methodAmounts.js";

const RECIPE = `Miso Aubergine with Soba
Serves 2

## Ingredients
- 2 aubergines
- 200 g soba noodles
- 2 garlic cloves, crushed
- 1 tbsp sesame oil
- 2 tbsp olive oil
- 1 tin (400 g) chopped tomatoes
- 2–3 spring onions, sliced
- Salt to taste

## Method
1. Halve the aubergines.`;

test("ingredientRefs: amounts and the names to look for", () => {
  const refs = ingredientRefs(RECIPE);
  const terms = (amount) => refs.filter((ref) => ref.amount === amount).map((ref) => ref.terms);
  assert.deepEqual(terms("200 g"), [["soba noodle", "noodle", "soba"]]);
  assert.deepEqual(terms("2"), [["aubergine"], ["garlic clove", "garlic", "clove"]]);
  // "oil" is in two ingredients, so only the full names count
  assert.deepEqual(terms("1 tbsp"), [["sesame oil", "sesame"]]);
  assert.deepEqual(terms("2 tbsp"), [["olive oil", "olive"]]);
  // no amount, no bracket
  assert.equal(refs.some((ref) => ref.terms.includes("salt")), false);
});

test("addAmounts: after the first mention in a step, plural or not", () => {
  const refs = ingredientRefs(RECIPE);
  assert.equal(addAmounts("Cook the noodles, then drain the noodles.", refs), "Cook the noodles (200 g), then drain the noodles.");
  assert.equal(addAmounts("Halve the aubergine.", refs), "Halve the aubergine (2).");
  assert.equal(addAmounts("Fry the garlic cloves in the olive oil.", refs), "Fry the garlic cloves (2) in the olive oil (2 tbsp).");
  assert.equal(addAmounts("Add the tomatoes and spring onions.", refs), "Add the tomatoes (1 tin) and spring onions (2–3).");
});

test("addAmounts: the planned servings scale the brackets", () => {
  const refs = ingredientRefs(RECIPE, 2);
  assert.equal(addAmounts("Cook the soba.", refs), "Cook the soba (400 g).");
  assert.equal(addAmounts("Add the spring onions.", refs), "Add the spring onions (4–6).");
});

test("addAmounts: leaves other words and existing brackets alone", () => {
  const refs = ingredientRefs(RECIPE);
  assert.equal(addAmounts("Bring water to the boil.", refs), "Bring water to the boil.");
  assert.equal(addAmounts("Add the noodles (all of them).", refs), "Add the noodles (all of them).");
  assert.equal(addAmounts("Season with salt.", refs), "Season with salt.");
  // the step says how much itself
  assert.equal(addAmounts("Cook 100 g noodles first.", refs), "Cook 100 g noodles first.");
  assert.equal(addAmounts("Halve 1 aubergine.", refs), "Halve 1 aubergine.");
});

test("addAmounts: the bracket can be wrapped for styling", () => {
  const refs = ingredientRefs(RECIPE);
  assert.equal(addAmounts("Cook the soba.", refs, (text) => "[" + text + "]"), "Cook the soba [(200 g)].");
});
