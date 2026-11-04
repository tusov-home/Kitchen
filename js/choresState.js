// Household chores. Uses the shared collection store and syncs through
// the Sheet's "chores" tab.
import { createCollection } from "./collection.js";
import { normaliseChore, nextDue, toDateString } from "./lib/chores.js";

export const chores = createCollection("chores", normaliseChore);

export function today() {
  return toDateString(new Date());
}

// Ticking off: a repeating chore moves to its next date; a one-off is
// marked done. Returns the saved chore.
export function markDone(id, byName) {
  const chore = chores.get(id);
  if (!chore) {
    return null;
  }
  const now = today();
  const changes = { lastDone: now, lastDoneBy: byName || "" };
  if (chore.repeat) {
    changes.due = nextDue(chore, now);
  } else {
    changes.done = true;
  }
  return chores.update(id, changes);
}

// Undo a tick on a one-off chore.
export function markNotDone(id) {
  return chores.update(id, { done: false });
}

// Removes all finished one-off chores.
export function clearDone() {
  const done = chores.getAll().filter((c) => c.done);
  for (const chore of done) {
    chores.remove(chore.id);
  }
  return done.length;
}
