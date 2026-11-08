import test from "node:test";
import assert from "node:assert/strict";
import { findDurations, timerLabel, formatClock } from "../js/lib/timers.js";

const seconds = (text) => findDurations(text).map((found) => found.seconds);
const words = (text) => findDurations(text).map((found) => text.slice(found.start, found.end));

test("findDurations: common ways of writing a time", () => {
  assert.deepEqual(seconds("Roast for 20 min."), [1200]);
  assert.deepEqual(seconds("Simmer 15 minutes, then rest 5 mins"), [900, 300]);
  assert.deepEqual(seconds("Bake 1 hour 30 minutes"), [5400]);
  assert.deepEqual(seconds("Braise 1 h and 15 min"), [4500]);
  assert.deepEqual(seconds("Leave 1½ hours"), [5400]);
  assert.deepEqual(seconds("Leave 1.5 hrs"), [5400]);
  assert.deepEqual(seconds("Toast 30 seconds"), [30]);
  assert.deepEqual(seconds("Chill for half an hour, or an hour"), [1800, 3600]);
});

test("findDurations: a range starts at its shorter end", () => {
  assert.deepEqual(seconds("Cook 10–12 minutes"), [600]);
  assert.deepEqual(seconds("Cook 3 to 4 min"), [180]);
});

test("findDurations: the exact words, without the full stop", () => {
  assert.deepEqual(words("Roast at 220 °C for 20 minutes."), ["20 minutes"]);
  assert.deepEqual(words("Cook 10-12 min until soft"), ["10-12 min"]);
});

test("findDurations: amounts and temperatures are not times", () => {
  assert.deepEqual(seconds("200 g soba noodles, 2 tbsp sesame, 220 °C, serves 4"), []);
  assert.deepEqual(seconds("2 shallots, 3 mint leaves"), []);
});

test("timerLabel: the first word of the step", () => {
  const text = "1. Roast at 220 °C for 20 minutes.\n2. Let rest 5 min.";
  const [roast, rest] = findDurations(text);
  assert.equal(timerLabel(text, roast.start), "Roast");
  assert.equal(timerLabel(text, rest.start), "Let rest");
  assert.equal(timerLabel("Boil. Simmer 10 min", 13), "Simmer");
  const grill = "Brush with miso, then grill 3–4 min until it bubbles.";
  assert.equal(timerLabel(grill, findDurations(grill)[0].start), "Grill");
});

test("formatClock: minutes and seconds, hours when needed", () => {
  assert.equal(formatClock(245), "4:05");
  assert.equal(formatClock(3750), "1:02:30");
  assert.equal(formatClock(0.2), "0:01");
  assert.equal(formatClock(-3), "0:00");
});
