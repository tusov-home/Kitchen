// Unit tests for the daily suggestion. Run with: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { lastCooked, seededRandom, dailySuggestions, activeOwners, toggleOwner, recipesOfOwners, initial } from "../js/lib/suggest.js";

test("last cooked date is read from the notes", () => {
  assert.equal(lastCooked("Cooked 2 Nov 2026\nLess salt\nCooked 14 Oct 2026"), "2026-11-02");
  assert.equal(lastCooked("cooked 3 Sept 2026"), "2026-09-03");
  assert.equal(lastCooked("Less chilli next time"), null);
  assert.equal(lastCooked(""), null);
});

test("the same text always gives the same random number", () => {
  assert.equal(seededRandom("2026-11-05|a"), seededRandom("2026-11-05|a"));
  assert.notEqual(seededRandom("2026-11-05|a"), seededRandom("2026-11-06|a"));
  const r = seededRandom("x");
  assert.ok(r >= 0 && r < 1);
});

const r = (id, title, extra) => Object.assign({ id: id, title: title, text: "", tags: [], notes: "", ratings: {} }, extra);
const loved = { K: { stars: 5, at: 1 }, T: { stars: 5, at: 1 } };
const meh = { K: { stars: 2, at: 1 } };

test("a recipe cooked this week is not suggested first", () => {
  const recipes = [
    r("a", "Ragu", { ratings: loved, notes: "Cooked 3 Nov 2026" }),
    r("b", "Dal", { ratings: loved, notes: "Cooked 1 Sep 2026" }),
  ];
  const list = dailySuggestions(recipes, "2026-11-05");
  assert.equal(list[0].recipe.title, "Dal");
  assert.equal(list[0].reason, "A favourite, rated 5 ★ · Not cooked in a while");
});

test("loved dishes beat disliked ones, on every day of a month", () => {
  const recipes = [r("a", "Loved", { ratings: loved }), r("b", "Meh", { ratings: meh })];
  for (let day = 1; day <= 30; day++) {
    const date = "2026-11-" + String(day).padStart(2, "0");
    assert.equal(dailySuggestions(recipes, date)[0].recipe.title, "Loved", date);
  }
});

test("weekend dishes come up on weekends, not on weekdays", () => {
  const recipes = [r("a", "Slow lamb", { tags: ["weekend"] }), r("b", "Quick pasta")];
  const saturday = dailySuggestions(recipes, "2026-11-07");
  assert.equal(saturday[0].recipe.title, "Slow lamb");
  assert.match(saturday[0].reason, /Something for the weekend/);
  assert.equal(dailySuggestions(recipes, "2026-11-04")[0].recipe.title, "Quick pasta"); // Wednesday
});

test("same day, same order; the order changes over days", () => {
  const recipes = "abcdefgh".split("").map((id) => r(id, "Dish " + id));
  const a = dailySuggestions(recipes, "2026-11-05").map((s) => s.recipe.id);
  const b = dailySuggestions(recipes, "2026-11-05").map((s) => s.recipe.id);
  assert.deepEqual(a, b);
  const firsts = new Set();
  for (let day = 1; day <= 14; day++) {
    firsts.add(dailySuggestions(recipes, "2026-11-" + String(day).padStart(2, "0"))[0].recipe.id);
  }
  assert.ok(firsts.size >= 4, "different dishes on different days: " + [...firsts]);
});

test("the suggestion starts with this phone's owner", () => {
  assert.deepEqual(activeOwners(["Kadi", "Tõnis"], undefined, "Tõnis"), ["Tõnis"]);
  assert.deepEqual(activeOwners(["Kadi", "Tõnis"], [], "Kadi"), ["Kadi"]);
});

test("a saved choice wins, unless nobody in it has recipes any more", () => {
  assert.deepEqual(activeOwners(["Kadi", "Tõnis"], ["Kadi", "Tõnis"], "Tõnis"), ["Kadi", "Tõnis"]);
  assert.deepEqual(activeOwners(["Kadi", "Tõnis"], ["Old"], "Tõnis"), ["Tõnis"]);
});

test("everyone counts if this phone's owner has no recipes", () => {
  assert.deepEqual(activeOwners(["Kadi", "Tõnis"], undefined, "Mari"), ["Kadi", "Tõnis"]);
  assert.deepEqual(activeOwners(["Kadi", "Tõnis"], undefined, ""), ["Kadi", "Tõnis"]);
});

test("owners switch on and off, but the last one stays on", () => {
  assert.deepEqual(toggleOwner(["Tõnis"], "Kadi"), ["Tõnis", "Kadi"]);
  assert.deepEqual(toggleOwner(["Tõnis", "Kadi"], "Tõnis"), ["Kadi"]);
  assert.deepEqual(toggleOwner(["Kadi"], "Kadi"), ["Kadi"]);
});

test("only the chosen owners' recipes count, plus old ones without an owner", () => {
  const recipes = [r("a", "A", { owner: "Kadi" }), r("b", "B", { owner: "Tõnis" }), r("c", "C", { owner: "" })];
  assert.deepEqual(recipesOfOwners(recipes, ["Kadi"]).map((x) => x.id), ["a", "c"]);
  assert.deepEqual(recipesOfOwners(recipes, ["Kadi", "Tõnis"]).map((x) => x.id), ["a", "b", "c"]);
});

test("an initial is the first letter, in capitals", () => {
  assert.equal(initial("Tõnis"), "T");
  assert.equal(initial(" kadi"), "K");
  assert.equal(initial("Õie"), "Õ");
});
