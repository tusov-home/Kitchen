// Pure helpers for chores: dates, repeating, grouping. No DOM.
//
// A chore: { id, title: "Vacuum", who: "Kristiina" or "" (anyone),
//   repeat: { every: 2, unit: "week" } or null (one-off),
//   due: "2026-11-08" or null, done: false (one-offs only),
//   lastDone: "2026-11-01" or null, lastDoneBy: "Tõnis",
//   updatedAt, deleted }
// Dates are plain "YYYY-MM-DD" strings in local time, so a chore due
// "today" doesn't shift with time zones or summer time.

export const UNITS = ["day", "week", "month"];

// Preset choices for the "Repeat" menu: value → repeat object.
export const REPEAT_PRESETS = [
  ["once", null],
  ["1-day", { every: 1, unit: "day" }],
  ["1-week", { every: 1, unit: "week" }],
  ["2-week", { every: 2, unit: "week" }],
  ["1-month", { every: 1, unit: "month" }],
  ["3-month", { every: 3, unit: "month" }],
];

export function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

export function parseDate(text) {
  const [y, m, d] = text.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(text, days) {
  const date = parseDate(text);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

// Adds a repeat interval. Months keep the day of the month where
// possible: 31 Jan + 1 month = 28 Feb (or 29 in a leap year).
export function addInterval(text, repeat) {
  if (repeat.unit === "day") {
    return addDays(text, repeat.every);
  }
  if (repeat.unit === "week") {
    return addDays(text, repeat.every * 7);
  }
  const date = parseDate(text);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + repeat.every);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return toDateString(date);
}

// When a repeating chore is due next, after being done today.
// It keeps its rhythm: done a day late, the next one is still on the
// usual day. But if it was so late that the next date has already
// passed, it counts from today instead.
export function nextDue(chore, today) {
  if (!chore.repeat) {
    return null;
  }
  const from = chore.due && chore.due <= today ? chore.due : today;
  let next = addInterval(from, chore.repeat);
  if (next <= today) {
    next = addInterval(today, chore.repeat);
  }
  return next;
}

export function daysBetween(fromText, toText) {
  return Math.round((parseDate(toText) - parseDate(fromText)) / 86400000);
}

// "Today", "Tomorrow", "2 days late", "Fri", "12 Nov"
export function dueLabel(due, today) {
  if (!due) {
    return "";
  }
  const days = daysBetween(today, due);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 0) return -days + " days late";
  const date = parseDate(due);
  if (days < 7) {
    return date.toLocaleDateString("en-GB", { weekday: "short" });
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// "Every week", "Every 2 weeks", "Every 3 months", "Once"
export function repeatLabel(repeat) {
  if (!repeat) {
    return "Once";
  }
  if (repeat.every === 1) {
    return "Every " + repeat.unit;
  }
  return "Every " + repeat.every + " " + repeat.unit + "s";
}

// Key for the Repeat menu, e.g. "2-week"; "custom" for anything else.
export function repeatKey(repeat) {
  if (!repeat) {
    return "once";
  }
  const key = repeat.every + "-" + repeat.unit;
  return REPEAT_PRESETS.some(([k]) => k === key) ? key : "custom";
}

export function normaliseChore(raw) {
  if (!raw || typeof raw.id !== "string" || !raw.id) {
    return null;
  }
  let repeat = null;
  if (raw.repeat && UNITS.includes(raw.repeat.unit)) {
    const every = Math.round(Number(raw.repeat.every));
    if (every >= 1 && every <= 365) {
      repeat = { every: every, unit: raw.repeat.unit };
    }
  }
  const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  return {
    id: raw.id,
    title: String(raw.title || "").trim(),
    who: String(raw.who || ""),
    repeat: repeat,
    due: isDate(raw.due) ? raw.due : null,
    done: repeat ? false : raw.done === true,
    lastDone: isDate(raw.lastDone) ? raw.lastDone : null,
    lastDoneBy: String(raw.lastDoneBy || ""),
    updatedAt: Number(raw.updatedAt) || 0,
    deleted: raw.deleted === true,
  };
}

export const GROUPS = ["Late", "Today", "This week", "Later", "Any time", "Done"];

// Groups chores for the list. who: "" for everyone, or a name (that
// person's chores plus the ones for anyone).
export function groupChores(chores, today, who) {
  const weekEnd = addDays(today, 6);
  const buckets = Object.fromEntries(GROUPS.map((g) => [g, []]));
  for (const chore of chores) {
    if (who && chore.who && chore.who !== who) {
      continue;
    }
    let group;
    if (chore.done) group = "Done";
    else if (!chore.due) group = "Any time";
    else if (chore.due < today) group = "Late";
    else if (chore.due === today) group = "Today";
    else if (chore.due <= weekEnd) group = "This week";
    else group = "Later";
    buckets[group].push(chore);
  }
  const byDue = (a, b) =>
    (a.due || "9999").localeCompare(b.due || "9999") || a.title.localeCompare(b.title);
  return GROUPS
    .map((group) => ({ group: group, chores: buckets[group].sort(byDue) }))
    .filter((g) => g.chores.length);
}

// How many chores need doing now (late or today) — for the tab badge.
export function dueNowCount(chores, today, who) {
  return chores.filter(
    (c) => !c.done && c.due && c.due <= today && (!who || !c.who || c.who === who)
  ).length;
}
