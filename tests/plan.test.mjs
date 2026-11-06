// Unit tests for the cooking plan helpers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalisePlan, mergePlan, planMeals, stepFactor } from "../js/lib/plan.js";

test("a plan from the Sheet is cleaned up", () => {
  assert.equal(normalisePlan({ meals: {} }), null);
  const plan = normalisePlan({ id: "current", meals: { a: { factor: "2", at: 5 }, b: "nonsense" } });
  assert.deepEqual(plan.meals, { a: { factor: 2, shopped: false, cooked: false, removed: false, at: 5 } });
});

test("meals merge one by one, the newest version of each winning", () => {
  const a = { id: "current", updatedAt: 10, meals: { soup: { factor: 1, at: 10 }, stew: { factor: 1, cooked: false, at: 5 } } };
  const b = { id: "current", updatedAt: 8, meals: { stew: { factor: 1, cooked: true, at: 8 }, cake: { factor: 2, at: 8 } } };
  const merged = mergePlan(a, b);
  assert.deepEqual(Object.keys(merged.meals).sort(), ["cake", "soup", "stew"]);
  assert.equal(merged.meals.stew.cooked, true);
  assert.equal(merged.updatedAt, 10);
});

test("the plan lists meals in the order added, without removed ones", () => {
  const plan = { meals: { b: { at: 2 }, a: { at: 1 }, c: { at: 3, removed: true } } };
  assert.deepEqual(planMeals(plan).map((m) => m.id), ["a", "b"]);
  assert.deepEqual(planMeals(null), []);
});

test("servings step one at a time, or by halves without a number", () => {
  assert.equal(stepFactor(1, 4, 1), 5 / 4);
  assert.equal(stepFactor(0.25, 4, -1), 0.25);
  assert.equal(stepFactor(1, null, 1), 1.5);
  assert.equal(stepFactor(0.5, null, -1), 0.5);
});
