// Home improvement projects. Uses the shared collection store and syncs
// through the Sheet's "projects" tab. Steps and materials merge entry by
// entry between phones.
import { createCollection } from "./collection.js";
import { newId } from "./lib/recipes.js";
import { normaliseProject, mergeProject, newEntry } from "./lib/projects.js";
import { toDateString } from "./lib/dates.js";

export const projects = createCollection("projects", normaliseProject, mergeProject);

export function createProject(fields) {
  return projects.put(Object.assign({ status: "idea", effort: "", who: "", notes: "", steps: {}, materials: {} }, fields));
}

export function setStatus(id, status) {
  const project = projects.get(id);
  if (!project) {
    return null;
  }
  const doneAt = status === "done" ? project.doneAt || toDateString(new Date()) : null;
  return projects.update(id, { status: status, doneAt: doneAt });
}

// ---------- Steps and materials ----------
// list: "steps" or "materials"; flag: "done" or "bought".

const FLAGS = { steps: "done", materials: "bought" };

export function addEntry(id, list, text) {
  const project = projects.get(id);
  if (!project || !text.trim()) {
    return null;
  }
  const { key, entry } = newEntry(project[list], text, FLAGS[list], Date.now(), newId);
  const map = Object.assign({}, project[list], { [key]: entry });
  projects.update(id, { [list]: map });
  return key;
}

function changeEntry(id, list, key, changes) {
  const project = projects.get(id);
  if (!project || !project[list][key]) {
    return;
  }
  const entry = Object.assign({}, project[list][key], changes, { at: Date.now() });
  const updates = { [list]: Object.assign({}, project[list], { [key]: entry }) };
  // The first ticked step means work has started.
  if (list === "steps" && changes.done && project.status === "idea") {
    updates.status = "doing";
  }
  projects.update(id, updates);
}

export function toggleEntry(id, list, key) {
  const project = projects.get(id);
  if (project && project[list][key]) {
    const flag = FLAGS[list];
    changeEntry(id, list, key, { [flag]: !project[list][key][flag] });
  }
}

export function setEntry(id, list, key, flagValue) {
  changeEntry(id, list, key, { [FLAGS[list]]: flagValue });
}

// Removed entries stay as small markers so the removal syncs too.
export function removeEntry(id, list, key) {
  changeEntry(id, list, key, { removed: true });
}
