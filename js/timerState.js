// Kitchen timers on this phone: several can run at once. Each one is
// { id, label, recipeId, seconds, state, endsAt, left }:
//   state "running": endsAt is when it rings (ms since 1970)
//   state "paused":  left is how many seconds were left
//   state "ringing": time's up, until someone taps Done
// Saved on the phone (not synced), so a reload keeps them.
import * as storage from "./storage.js";

let timers = storage.loadTimers();
const listeners = [];

function changed() {
  storage.saveTimers(timers);
  for (const listener of listeners) {
    listener();
  }
}

export function onChange(listener) {
  listeners.push(listener);
}

export function getTimers() {
  return timers;
}

// Seconds left on a timer, now.
export function secondsLeft(timer, now = Date.now()) {
  if (timer.state === "running") {
    return Math.max(0, (timer.endsAt - now) / 1000);
  }
  return timer.state === "paused" ? timer.left : 0;
}

// The same step's timer, if one is going already (so a second tap doesn't
// start a twin).
export function findSame(recipeId, label, seconds) {
  return timers.find((timer) => timer.recipeId === recipeId && timer.label === label && timer.seconds === seconds);
}

export function start(label, recipeId, seconds) {
  const timer = {
    id: "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    label: label,
    recipeId: recipeId,
    seconds: seconds,
    state: "running",
    endsAt: Date.now() + seconds * 1000,
    left: seconds,
  };
  timers = [...timers, timer];
  changed();
  return timer;
}

function update(id, change) {
  timers = timers.map((timer) => (timer.id === id ? Object.assign({}, timer, change(timer)) : timer));
  changed();
}

// Running ↔ paused.
export function togglePause(id) {
  update(id, (timer) =>
    timer.state === "running"
      ? { state: "paused", left: secondsLeft(timer) }
      : timer.state === "paused"
        ? { state: "running", endsAt: Date.now() + timer.left * 1000 }
        : {},
  );
}

export function remove(id) {
  timers = timers.filter((timer) => timer.id !== id);
  changed();
}

// Turns every running timer whose time is up into a ringing one.
// True if any started ringing just now.
export function checkFinished(now = Date.now()) {
  const finished = timers.filter((timer) => timer.state === "running" && timer.endsAt <= now);
  if (!finished.length) {
    return false;
  }
  timers = timers.map((timer) => (finished.includes(timer) ? Object.assign({}, timer, { state: "ringing", left: 0 }) : timer));
  changed();
  return true;
}

// Done: takes away every ringing timer.
export function dismissRinging() {
  const before = timers.length;
  timers = timers.filter((timer) => timer.state !== "ringing");
  if (timers.length !== before) {
    changed();
  }
}
