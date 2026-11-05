// Unit tests for the project helpers. Run with: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normaliseProject, mergeProject, entryList, newEntry, progress, materialsToBuy, groupProjects,
} from "../js/lib/projects.js";

test("projects from the Sheet are cleaned up", () => {
  const p = normaliseProject({ id: "p", title: " Shelf ", status: "weird", effort: "huge", steps: { a: { text: "Drill", done: "yes" } } });
  assert.equal(p.title, "Shelf");
  assert.equal(p.status, "idea");
  assert.equal(p.effort, "");
  assert.deepEqual(p.steps.a, { text: "Drill", done: false, order: 0, at: 0, removed: false });
  assert.equal(normaliseProject({ title: "no id" }), null);
});

test("steps from two phones are combined entry by entry", () => {
  const base = normaliseProject({ id: "p", title: "Shelf", updatedAt: 1, steps: {
    a: { text: "Buy plugs", done: false, order: 1, at: 1 },
  } });
  // Phone A ticks "Buy plugs"; phone B adds "Drill holes" and renames.
  const phoneA = Object.assign({}, base, { updatedAt: 3, steps: { a: { text: "Buy plugs", done: true, order: 1, at: 3, removed: false } } });
  const phoneB = Object.assign({}, base, { updatedAt: 2, title: "Hallway shelf", steps: {
    a: base.steps.a, b: { text: "Drill holes", done: false, order: 2, at: 2, removed: false },
  } });
  const merged = mergeProject(phoneA, phoneB);
  assert.equal(merged.title, "Shelf", "the newer version wins for the title");
  assert.equal(merged.steps.a.done, true);
  assert.equal(merged.steps.b.text, "Drill holes");
});

test("entries keep their order; removed ones are hidden", () => {
  const map = {
    x: { text: "Second", order: 2, at: 5 },
    y: { text: "First", order: 1, at: 9 },
    z: { text: "Gone", order: 3, at: 1, removed: true },
  };
  assert.deepEqual(entryList(map).map((e) => e.text), ["First", "Second"]);
  const added = newEntry(map, " Third ", "done", 10, () => "k");
  assert.deepEqual(added, { key: "k", entry: { text: "Third", done: false, order: 4, at: 10, removed: false } });
});

test("progress and materials still to buy", () => {
  const p = normaliseProject({ id: "p", steps: {
    a: { text: "A", done: true, order: 1 }, b: { text: "B", order: 2 }, c: { text: "C", done: true, removed: true },
  }, materials: { m: { text: "Paint", bought: true }, n: { text: "Screws" } } });
  assert.deepEqual(progress(p), { done: 1, total: 2 });
  assert.deepEqual(materialsToBuy(p).map((m) => m.text), ["Screws"]);
});

test("projects are grouped: in progress, ideas, done", () => {
  const list = [
    { title: "Paint bedroom", status: "idea", who: "" },
    { title: "Fix tap", status: "doing", who: "Tõnis" },
    { title: "Hang shelf", status: "done", who: "", doneAt: "2026-10-01" },
    { title: "Herb box", status: "done", who: "Kristiina", doneAt: "2026-11-01" },
    { title: "Bike rack", status: "idea", who: "Kristiina" },
  ];
  const groups = groupProjects(list, "");
  assert.deepEqual(groups.map((g) => g.label), ["In progress", "Ideas", "Done"]);
  assert.deepEqual(groups[1].projects.map((p) => p.title), ["Bike rack", "Paint bedroom"]);
  assert.deepEqual(groups[2].projects.map((p) => p.title), ["Herb box", "Hang shelf"], "newest done first");
  const tonis = groupProjects(list, "Tõnis").flatMap((g) => g.projects.map((p) => p.title));
  assert.deepEqual(tonis, ["Fix tap", "Paint bedroom", "Hang shelf"]);
});
