// The bar above the recipe's bottom buttons: jump straight to the notes,
// ingredients or method. It marks the part you're reading as you scroll.
import { findJumps, headingOf } from "../lib/sections.js";

const bar = document.getElementById("recipe-jump");
const view = document.getElementById("view-recipe");
const notesBox = document.getElementById("recipe-notes-box");

let jumps = []; // { label, target, button }
// The part you just jumped to stays marked, even when a short part leaves
// the next one on screen, until you scroll yourself.
let chosen = null;

function go(jump) {
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  chosen = jump.label;
  jump.target.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  markCurrent();
}

function scrolledByHand() {
  chosen = null;
}

function markCurrent() {
  if (view.hidden || jumps.length === 0) {
    return;
  }
  // The last part that has reached the upper part of the screen; at the
  // very bottom, the last part, as it can't scroll any higher.
  const line = window.innerHeight * 0.4;
  const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  let current = -1;
  jumps.forEach(function (jump, index) {
    if (jump.target.getBoundingClientRect().top <= line) {
      current = index;
    }
  });
  if (atEnd) {
    current = jumps.length - 1;
  }
  jumps.forEach(function (jump, index) {
    jump.button.classList.toggle("active", chosen ? jump.label === chosen : index === current);
  });
}

// Call after the recipe text is drawn.
export function renderJump(body) {
  chosen = null;
  // Real headings, and lines like "**Ingredients**" that act as headings.
  const headings = [...body.querySelectorAll("h1, h2, h3, h4, h5, h6, p")].filter(
    (element) => element.tagName !== "P" || headingOf(element.textContent) !== null
  );
  const found = findJumps(headings.map((heading) => heading.textContent));
  const parts = [];
  if (!notesBox.hidden) {
    parts.push({ label: "Notes", target: notesBox });
  }
  if (found.ingredients !== -1) {
    parts.push({ label: "Ingredients", target: headings[found.ingredients] });
  }
  if (found.method !== -1) {
    parts.push({ label: "Method", target: headings[found.method] });
  }

  jumps = parts.map(function (part) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "jump-button";
    button.textContent = part.label;
    const jump = Object.assign(part, { button: button });
    button.addEventListener("click", () => go(jump));
    return jump;
  });
  bar.replaceChildren(...jumps.map((jump) => jump.button));
  bar.hidden = jumps.length < 2;
  markCurrent();
}

// For the keyboard: I and M.
export function jumpTo(label) {
  const jump = jumps.find((item) => item.label === label);
  if (jump) {
    go(jump);
  }
}

export function initRecipeJump() {
  window.addEventListener("scroll", markCurrent, { passive: true });
  window.addEventListener("touchmove", scrolledByHand, { passive: true });
  window.addEventListener("wheel", scrolledByHand, { passive: true });
}
