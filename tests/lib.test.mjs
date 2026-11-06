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

// ---------- Ratings ----------
import { mergeRatings, averageRating, ratingList } from "../js/lib/recipes.js";

test("ratings merge person by person, newest wins", () => {
  const merged = mergeRatings(
    { Tõnis: { stars: 4, at: 5 }, Kadi: { stars: 2, at: 1 } },
    { Kadi: { stars: 5, at: 6 }, Tõnis: { stars: 1, at: 2 } }
  );
  assert.deepEqual(merged, { Tõnis: { stars: 4, at: 5 }, Kadi: { stars: 5, at: 6 } });
});

test("recipe merge keeps ratings from both versions", () => {
  const merged = mergeRecipes(
    [{ id: "a", title: "new", updatedAt: 2, ratings: { T: { stars: 4, at: 1 } } }],
    [{ id: "a", title: "old", updatedAt: 1, ratings: { K: { stars: 5, at: 3 } } }]
  );
  assert.equal(merged[0].title, "new");
  assert.deepEqual(Object.keys(merged[0].ratings).sort(), ["K", "T"]);
});

test("average ignores cleared ratings", () => {
  const recipe = { ratings: { A: { stars: 4, at: 1 }, B: { stars: 5, at: 1 }, C: { stars: 0, at: 1 } } };
  assert.equal(averageRating(recipe), 4.5);
  assert.equal(averageRating({ ratings: {} }), null);
  assert.deepEqual(ratingList(recipe).map((r) => r.name), ["A", "B"]);
});

test("normalise reads ratings stored as JSON text in the Sheet", () => {
  const r = normaliseRecipe({ id: "x", servings: "4", ratings: '{"Kadi":{"stars":5,"at":9}}' });
  assert.equal(r.servings, 4);
  assert.deepEqual(r.ratings, { Kadi: { stars: 5, at: 9 } });
});

// ---------- Servings ----------
import { detectServings, scaleLine, formatAmount, stepServings } from "../js/lib/scale.js";

test("servings found in common phrasings", () => {
  assert.equal(detectServings("Serves 2 · 25 minutes"), 2);
  assert.equal(detectServings("## Ingredients (4 servings)"), 4);
  assert.equal(detectServings("Portions: 6"), 6);
  assert.equal(detectServings("Roast for 20 minutes"), null);
});

test("amounts scale, temperatures and tin sizes don't", () => {
  assert.equal(scaleLine("200 g soba", 2), "400 g soba");
  assert.equal(scaleLine("600g chicken", 0.5), "300g chicken");
  assert.equal(scaleLine("1½ tbsp miso", 2), "3 tbsp miso");
  assert.equal(scaleLine("1/2 tsp salt", 0.5), "¼ tsp salt");
  assert.equal(scaleLine("2–3 garlic cloves", 2), "4–6 garlic cloves");
  assert.equal(scaleLine("1 tin tomatoes (400 g)", 2), "2 tin tomatoes (400 g)");
  assert.equal(scaleLine("Bake at 220 °C", 2), "Bake at 220 °C");
  assert.equal(scaleLine("Chinese 5-spice, 1 tsp", 2), "Chinese 5-spice, 2 tsp");
  assert.equal(scaleLine("Salt to taste", 2), "Salt to taste");
});

test("amounts are shown kitchen-friendly", () => {
  assert.equal(formatAmount(1203), "1205");
  assert.equal(formatAmount(37.4), "37");
  assert.equal(formatAmount(1.5), "1½");
  assert.equal(formatAmount(0.33), "⅓");
  assert.equal(formatAmount(2.98), "3");
  assert.equal(formatAmount(1.33), "1⅓");
  assert.equal(formatAmount(1.2), "1.2");
});

test("stepper limits", () => {
  assert.equal(stepServings(1, -1, true), 1);
  assert.equal(stepServings(2, 1, true), 3);
  assert.equal(stepServings(0.5, -1, false), 0.5);
  assert.equal(stepServings(1, 1, false), 1.5);
});

test("markdown scales only the ingredients section", () => {
  const md = "Serves 2\n\n## Ingredients\n- 200 g rice\n### For the sauce\n- 2 tbsp soy\n\n## Method\n1. Cook 200 g rice for 10 minutes.";
  const html = renderMarkdown(md, { scale: 2 });
  assert.match(html, /<span class="scaled">400<\/span> g rice/);
  assert.match(html, /<span class="scaled">4<\/span> tbsp soy/);
  assert.match(html, /Cook 200 g rice for 10 minutes/);
  assert.match(html, /<p>Serves 2<\/p>/);
});

test("markdown with bold pseudo-headings", () => {
  const md = "**Ingredients**\n- 3 eggs\n\n**Method**\n1. Whisk 3 eggs";
  const html = renderMarkdown(md, { scale: 2 });
  assert.match(html, /<span class="scaled">6<\/span> eggs/);
  assert.match(html, /Whisk 3 eggs/);
});

test("without an ingredients heading, only bullet amounts scale", () => {
  const html = renderMarkdown("- 2 onions\n\n1. Fry 2 onions 5 minutes", { scale: 2 });
  assert.match(html, /<span class="scaled">4<\/span> onions/);
  assert.match(html, /Fry 2 onions 5 minutes/);
});

// ---------- Owners ----------
import { canEdit, copyForEditing } from "../js/lib/recipes.js";

test("only the owner can edit; recipes without owner are open", () => {
  assert.equal(canEdit({ owner: "Kadi" }, "Kadi"), true);
  assert.equal(canEdit({ owner: "Kadi" }, "Tõnis"), false);
  assert.equal(canEdit({ owner: "" }, "Tõnis"), true);
  assert.equal(canEdit({ owner: "Kadi" }, ""), false);
});

test("a copy keeps the recipe but not notes, ratings or owner", () => {
  const original = {
    id: "o1", title: "Ragu", text: "# Ragu\n\nSlow cook.", tags: ["weekend"], servings: 4,
    notes: "Kadi's note", ratings: { Kadi: { stars: 5, at: 1 } }, owner: "Kadi",
  };
  const copy = copyForEditing(original);
  assert.deepEqual(copy, { title: "Ragu", kind: "meal", text: "Slow cook.", tags: ["weekend"], servings: 4, notes: "", copyOf: "o1" });
  copy.tags.push("spicy");
  assert.deepEqual(original.tags, ["weekend"], "original tags untouched");
});

// ---------- Owner filter and sorting ----------
import { allOwners } from "../js/lib/recipes.js";
import { findJumps } from "../js/lib/sections.js";

const shelf = [
  { id: "1", title: "banana bread", text: "", tags: [], owner: "Tõnis", updatedAt: 3, ratings: { K: { stars: 3, at: 1 } } },
  { id: "2", title: "Apple pie", text: "", tags: [], owner: "Kristiina", updatedAt: 1, ratings: { K: { stars: 5, at: 1 }, T: { stars: 4, at: 1 } } },
  { id: "3", title: "Carrot soup", text: "", tags: [], owner: "Tõnis", updatedAt: 2, ratings: {} },
  { id: "4", title: "Dal", text: "", tags: [], owner: "Kristiina", updatedAt: 4, ratings: { T: { stars: 3, at: 1 } } },
];

test("sort A–Z ignores upper/lower case", () => {
  assert.deepEqual(visibleRecipes(shelf, "", "", { sort: "az" }).map((r) => r.id), ["2", "1", "3", "4"]);
});

test("sort by rating: best first, ties A–Z, unrated last", () => {
  assert.deepEqual(visibleRecipes(shelf, "", "", { sort: "rating" }).map((r) => r.id), ["2", "1", "4", "3"]);
});

test("newest stays the default", () => {
  assert.deepEqual(visibleRecipes(shelf, "", "").map((r) => r.id), ["4", "1", "3", "2"]);
});

test("filter by owner, and list of owners", () => {
  assert.deepEqual(visibleRecipes(shelf, "", "", { owner: "Tõnis", sort: "az" }).map((r) => r.id), ["1", "3"]);
  assert.deepEqual(allOwners(shelf), ["Kristiina", "Tõnis"]);
});

test("a recipe is a meal unless it says it's a sauce", () => {
  assert.equal(normaliseRecipe({ id: "a" }).kind, "meal");
  assert.equal(normaliseRecipe({ id: "a", kind: "nonsense" }).kind, "meal");
  assert.equal(normaliseRecipe({ id: "a", kind: "sauce" }).kind, "sauce");
});

test("a copy keeps the type", () => {
  assert.equal(copyForEditing({ title: "Chilli oil", text: "Heat.", tags: [], kind: "sauce" }).kind, "sauce");
});

test("the jump bar finds ingredients and method headings", () => {
  assert.deepEqual(findJumps(["Ingredients", "Method", "To serve"]), { ingredients: 0, method: 1 });
  assert.deepEqual(findJumps(["Intro", "Zutaten", "Zubereitung"]), { ingredients: 1, method: 2 });
  assert.deepEqual(findJumps(["To serve"]), { ingredients: -1, method: -1 });
});
