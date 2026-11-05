// Pure helpers for home improvement projects. No DOM; easy to test.
//
// A project:
// { id, title: "Hang shelf in hallway",
//   status: "idea" | "doing" | "done",
//   effort: "" | "evening" | "weekend" | "bigger",
//   who: "Tõnis" or "" (anyone), notes: "50 cm wide, plugs for concrete",
//   steps:     { "<key>": { text, done, order, at, removed } },
//   materials: { "<key>": { text, bought, order, at, removed } },
//   doneAt: "2026-11-05" or null, updatedAt, deleted }
// Steps and materials are maps of timestamped entries, so a step added
// on one phone and a tick on the other both survive a sync.

export const STATUSES = ["doing", "idea", "done"];
export const STATUS_LABELS = { idea: "Idea", doing: "Doing", done: "Done" };
export const GROUP_LABELS = { doing: "In progress", idea: "Ideas", done: "Done" };
export const EFFORTS = ["", "evening", "weekend", "bigger"];
export const EFFORT_LABELS = { "": "Not sure", evening: "An evening", weekend: "A weekend", bigger: "Bigger" };

function cleanEntries(raw, flag) {
  const result = {};
  if (!raw || typeof raw !== "object") {
    return result;
  }
  for (const [key, entry] of Object.entries(raw)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    result[key] = {
      text: String(entry.text || ""),
      [flag]: entry[flag] === true,
      order: Number(entry.order) || 0,
      at: Number(entry.at) || 0,
      removed: entry.removed === true,
    };
  }
  return result;
}

export function normaliseProject(raw) {
  if (!raw || typeof raw.id !== "string" || !raw.id) {
    return null;
  }
  return {
    id: raw.id,
    title: String(raw.title || "").trim(),
    status: STATUSES.includes(raw.status) ? raw.status : "idea",
    effort: EFFORTS.includes(raw.effort) ? raw.effort : "",
    who: String(raw.who || ""),
    notes: String(raw.notes || ""),
    steps: cleanEntries(raw.steps, "done"),
    materials: cleanEntries(raw.materials, "bought"),
    doneAt: typeof raw.doneAt === "string" ? raw.doneAt : null,
    updatedAt: Number(raw.updatedAt) || 0,
    deleted: raw.deleted === true,
  };
}

function mergeEntries(a, b) {
  const result = Object.assign({}, a || {});
  for (const [key, entry] of Object.entries(b || {})) {
    if (!result[key] || entry.at > result[key].at) {
      result[key] = entry;
    }
  }
  return result;
}

// Two versions of the same project: the newer one wins for title,
// status and so on, but steps and materials are combined entry by entry.
export function mergeProject(a, b) {
  const newer = b.updatedAt > a.updatedAt ? b : a;
  if (newer.deleted) {
    return newer;
  }
  return Object.assign({}, newer, {
    steps: mergeEntries(a.steps, b.steps),
    materials: mergeEntries(a.materials, b.materials),
  });
}

// Visible entries in the order they were added.
export function entryList(map) {
  return Object.entries(map || {})
    .filter(([, entry]) => !entry.removed)
    .sort(([, a], [, b]) => a.order - b.order || a.at - b.at)
    .map(([key, entry]) => Object.assign({ key: key }, entry));
}

// A new entry at the end of the list. Returns { key, entry }.
export function newEntry(map, text, flag, now, makeKey) {
  // Count removed entries too, so a new entry never shares a number.
  const order = Object.values(map || {}).reduce((max, e) => Math.max(max, Number(e.order) || 0), 0) + 1;
  return { key: makeKey(), entry: { text: text.trim(), [flag]: false, order: order, at: now, removed: false } };
}

export function progress(project) {
  const steps = entryList(project.steps);
  return { done: steps.filter((s) => s.done).length, total: steps.length };
}

export function materialsToBuy(project) {
  return entryList(project.materials).filter((m) => !m.bought);
}

// Projects grouped: In progress, Ideas, Done. Done newest first; the
// others A–Z. who: "" for everyone, or a name (theirs plus anyone's).
export function groupProjects(projects, who) {
  const groups = [];
  for (const status of STATUSES) {
    const list = projects
      .filter((p) => p.status === status && (!who || !p.who || p.who === who))
      .sort(function (a, b) {
        if (status === "done") {
          return (b.doneAt || "").localeCompare(a.doneAt || "") || a.title.localeCompare(b.title);
        }
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      });
    if (list.length) {
      groups.push({ status: status, label: GROUP_LABELS[status], projects: list });
    }
  }
  return groups;
}
