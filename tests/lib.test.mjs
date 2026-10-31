// Unit tests for the pure helpers. Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  titleFromText,
  bodyWithoutTitle,
  parseTags,
  visibleRecipes,
  mergeRecipes,
  normaliseRecipe,
  cookedNote,
} from "../js/lib/recipes.js";
import { renderMarkdown } from "../js/lib/markdown.js";

test("title comes from the first non-empty line, without markdown", () => {
  assert.equal(titleFromText("\n\n# **Miso Aubergine**\nServes 2"), "Miso Aubergine");
  assert.equal(titleFromText("Recipe: Beef Shakshuka\n..."), "Beef Shakshuka");
  assert.equal(titleFromText(""), "");
});

test("title line is not repeated in the body", () => {
  assert.equal(bodyWithoutTitle("# Ragu\n\nSlow cook.", "Ragu"), "Slow cook.");
  assert.equal(bodyWithoutTitle("Intro line\nMore", "Ragu"), "Intro line\nMore");
});

test("tags are trimmed, lowercased and unique", () => {
  assert.deepEqual(parseTags(" Quick, weekend ,quick,, "), ["quick", "weekend"]);
});

const recipes = [
  { id: "1", title: "Chicken thighs", text: "couscous", tags: ["quick"], updatedAt: 1, deleted: false },
  { id: "2", title: "Beef ragu", text: "with chicken stock", tags: ["weekend"], updatedAt: 3, deleted: false },
  { id: "3", title: "Old", text: "", tags: [], updatedAt: 5, deleted: true },
];

test("search finds title matches first, hides deleted", () => {
  const found = visibleRecipes(recipes, "chicken", "");
  assert.deepEqual(found.map((r) => r.id), ["1", "2"]);
  assert.deepEqual(visibleRecipes(recipes, "", "").map((r) => r.id), ["2", "1"]);
  assert.deepEqual(visibleRecipes(recipes, "", "weekend").map((r) => r.id), ["2"]);
});

test("merge keeps the newest version of each recipe", () => {
  const merged = mergeRecipes(
    [{ id: "a", title: "old", updatedAt: 1 }, { id: "b", title: "b", updatedAt: 1 }],
    [{ id: "a", title: "new", updatedAt: 2 }, { id: "c", title: "c", updatedAt: 1 }]
  );
  const byId = Object.fromEntries(merged.map((r) => [r.id, r.title]));
  assert.deepEqual(byId, { a: "new", b: "b", c: "c" });
});

test("normalise accepts Sheet-style values", () => {
  const r = normaliseRecipe({ id: "x", tags: "a, b", updatedAt: "12", deleted: "TRUE" });
  assert.deepEqual(r.tags, ["a", "b"]);
  assert.equal(r.updatedAt, 12);
  assert.equal(r.deleted, true);
  assert.equal(normaliseRecipe({ title: "no id" }), null);
});

test("cooked note has a readable date", () => {
  assert.equal(cookedNote(new Date(2026, 10, 12)), "Cooked 12 Nov 2026");
});

test("markdown escapes HTML and renders lists", () => {
  const html = renderMarkdown("## Ingredients\n- 200 g **feta**\n- <script>x</script>\n\n1. Heat pan\n2. Fry");
  assert.match(html, /<h3>Ingredients<\/h3>/);
  assert.match(html, /<li>200 g <strong>feta<\/strong><\/li>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<ol>\n<li>Heat pan<\/li>/);
});

test("markdown renders tables", () => {
  const html = renderMarkdown("| Item | Amount |\n|---|---|\n| Rice | 200 g |");
  assert.match(html, /<th>Item<\/th>/);
  assert.match(html, /<td>200 g<\/td>/);
  assert.doesNotMatch(html, /---/);
});
