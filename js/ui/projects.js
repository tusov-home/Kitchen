// The projects list and the add/edit dialog.
import { projects, createProject } from "../projectsState.js";
import { ask } from "./ask.js";
import { groupProjects, progress, materialsToBuy, EFFORT_LABELS } from "../lib/projects.js";
import { allOwners } from "../lib/recipes.js";
import * as state from "../state.js";
import { getMyName } from "./name.js";
import { go } from "./router.js";
import { showToast } from "./toast.js";
import * as storage from "../storage.js";

const filterBar = document.getElementById("projects-filter");
const groupsBox = document.getElementById("projects-groups");
const empty = document.getElementById("projects-empty");
const addButton = document.getElementById("project-add");

// Everyone we know: this phone's name, recipe owners, people on projects.
function knownNames() {
  const names = new Set(allOwners(state.getRecipes()));
  const mine = getMyName();
  if (mine) {
    names.add(mine);
  }
  for (const project of projects.getAll()) {
    if (project.who) {
      names.add(project.who);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

const dialog = document.getElementById("project-dialog");
const form = document.getElementById("project-form");
const dialogTitle = document.getElementById("project-dialog-title");
const titleInput = document.getElementById("project-title-input");
const effortSelect = document.getElementById("project-effort");
const whoSelect = document.getElementById("project-who");
const deleteButton = document.getElementById("project-delete");

let who = storage.loadSettings().projectsWho || "";
let editingId = null;

function chip(label, selected, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tag" + (selected ? " selected" : "");
  button.textContent = label;
  button.setAttribute("aria-pressed", selected ? "true" : "false");
  button.addEventListener("click", onClick);
  return button;
}

// "An evening · Tõnis · 2 of 5 steps · 3 to buy"
export function projectSummary(project) {
  const parts = [];
  if (project.effort) {
    parts.push(EFFORT_LABELS[project.effort]);
  }
  parts.push(project.who || "Anyone");
  const p = progress(project);
  if (p.total) {
    parts.push(p.done + " of " + p.total + " steps");
  }
  const toBuy = materialsToBuy(project).length;
  if (toBuy && project.status !== "done") {
    parts.push(toBuy + " to buy");
  }
  return parts.join(" · ");
}

function projectCard(project) {
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.href = "#/project/" + encodeURIComponent(project.id);
  link.className = "recipe-card project-card status-" + project.status;
  const title = document.createElement("span");
  title.className = "recipe-card-title";
  title.textContent = project.title;
  const meta = document.createElement("span");
  meta.className = "recipe-card-tags";
  meta.textContent = projectSummary(project);
  link.append(title, meta);
  const p = progress(project);
  if (p.total && project.status !== "done") {
    const track = document.createElement("span");
    track.className = "progress-track card-progress";
    const fill = document.createElement("span");
    fill.className = "progress-fill";
    fill.style.width = Math.round((p.done / p.total) * 100) + "%";
    track.appendChild(fill);
    link.appendChild(track);
  }
  item.appendChild(link);
  return item;
}

export function renderProjects() {
  document.title = "Projects · Kitchen";
  const all = projects.getAll();
  const names = knownNames();
  if (who && !names.includes(who)) {
    who = "";
  }
  filterBar.replaceChildren();
  filterBar.hidden = names.length === 0 || all.length === 0;
  for (const name of ["", ...names]) {
    filterBar.appendChild(
      chip(name || "Everyone", name === who, function () {
        who = name;
        storage.saveSettings(Object.assign(storage.loadSettings(), { projectsWho: who }));
        renderProjects();
      })
    );
  }

  groupsBox.replaceChildren();
  for (const group of groupProjects(all, who)) {
    const section = document.createElement("section");
    section.className = "shop-section project-group group-" + group.status;
    const heading = document.createElement("h2");
    heading.textContent = group.label + " (" + group.projects.length + ")";
    const list = document.createElement("ul");
    list.className = "recipe-list";
    for (const project of group.projects) {
      list.appendChild(projectCard(project));
    }
    section.append(heading, list);
    groupsBox.appendChild(section);
  }
  empty.hidden = all.length > 0;
}

function fillWho(selected) {
  whoSelect.replaceChildren(new Option("Anyone", ""));
  const names = knownNames();
  if (selected && !names.includes(selected)) {
    names.push(selected);
  }
  for (const name of names) {
    whoSelect.add(new Option(name, name));
  }
  whoSelect.value = selected || "";
}

// id = null for a new project.
export function openProjectDialog(id) {
  const project = id ? projects.get(id) : null;
  editingId = project ? project.id : null;
  dialogTitle.textContent = project ? "Edit project" : "Add project";
  titleInput.value = project ? project.title : "";
  effortSelect.value = project ? project.effort : "";
  fillWho(project ? project.who : "");
  deleteButton.hidden = !project;
  dialog.returnValue = "";
  dialog.showModal();
}

export function initProjects() {
  addButton.addEventListener("click", () => openProjectDialog(null));

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (event.submitter && event.submitter.value === "cancel") {
      dialog.close();
      return;
    }
    if (!form.reportValidity()) {
      return;
    }
    const fields = { title: titleInput.value.trim(), effort: effortSelect.value, who: whoSelect.value };
    dialog.close();
    if (editingId) {
      projects.update(editingId, fields);
      showToast("Project saved");
    } else {
      // New project: open it straight away to add steps and things to buy.
      const project = createProject(fields);
      go("#/project/" + encodeURIComponent(project.id));
    }
  });

  deleteButton.addEventListener("click", function () {
    const project = projects.get(editingId);
    if (!project) {
      return;
    }
    ask("Delete \"" + project.title + "\"? This also removes it on the other phone.", "Delete", true).then(function (yes) {
      if (yes) {
        projects.remove(project.id);
        dialog.close();
        go("#/projects", true);
      }
    });
  });
}
