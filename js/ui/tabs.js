// Page icons in the top bar: Recipes · Shopping · Pantry · Projects. Tap a tab, swipe
// left/right anywhere on a page, or press ← / → on the laptop.
import { go, goBack, closeToList } from "./router.js";
import * as storage from "../storage.js";

export const TABS = [
  { id: "list", screens: ["list"], hash: () => "#/" },
  { id: "shopping", screens: ["shopping"], hash: () => "#/shopping" },
  { id: "pantry", screens: ["pantry"], hash: () => "#/pantry" },
  { id: "projects", screens: ["projects"], hash: () => "#/projects" },
];

// Pages opened from a tab still light up its tab.
const BELONGS_TO = { recipe: "list", project: "projects", plan: "list" };

const tabbar = document.getElementById("tabbar");
const swipeHint = document.getElementById("swipe-hint");

// Android uses the outer edges for its own Back gesture; leave them alone.
const EDGE_PX = 20;
// After this many pixels we decide: sideways (page swipe) or up/down (scroll).
const DECIDE_PX = 8;
// Let go past this distance, or flick quickly, to change page.
const COMMIT_PX = 55;
// Pulling a recipe down from its top closes it after this distance.
const CLOSE_PX = 110;
const FLICK_PX = 25;
const FLICK_SPEED = 0.35; // pixels per millisecond
// At the first or last page the page only moves a little, like a rubber band.
const RUBBER_BAND = 0.25;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let getScreen = () => "list";
let swipeDirection = 0; // -1: came from the left, +1: from the right
// On a recipe, a swipe doesn't change tabs: this decides what it does.
let recipeSwipe = () => {};

export function onRecipeSwipe(handler) {
  recipeSwipe = handler;
}

// The next screen slides in from the right.
export function slideInNext() {
  swipeDirection = 1;
}

export function isTabScreen(screen) {
  return tabIndex(screen) !== -1;
}

function tabIndex(screen) {
  return TABS.findIndex((tab) => tab.screens.includes(screen));
}

function tabOf(screen) {
  const index = tabIndex(screen);
  return index !== -1 ? TABS[index].id : BELONGS_TO[screen] || null;
}

// Moving between tabs (tabId: "list", "shopping", "pantry", "projects").
// To keep the phone's Back button sensible: from Recipes, a tab opens on
// top (Back returns to Recipes); between the other tabs, the page is
// swapped (Back still returns to Recipes); going to Recipes steps back.
export function goToTab(tabId) {
  const from = getScreen();
  const targetIndex = TABS.findIndex((tab) => tab.id === tabId);
  const target = TABS[targetIndex];
  if (!target) {
    return;
  }
  if (isTabScreen(from) && tabOf(from) === tabId) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const fromIndex = tabIndex(from);
  swipeDirection = fromIndex === -1 ? 0 : targetIndex > fromIndex ? 1 : -1;
  if (tabId === "list" || (!isTabScreen(from) && tabOf(from) === tabId)) {
    // Back to Recipes, or from a project page back to its list.
    goBack(target.hash());
  } else if (from === "recipe" || from === "plan" || (isTabScreen(from) && from !== "list")) {
    // Leaving a recipe closes it: Back and swiping lead to Recipes, not to it.
    go(target.hash(), true);
  } else {
    go(target.hash());
  }
}

// +1 = next tab, -1 = previous tab. Stops at the ends.
export function stepTab(direction) {
  const index = tabIndex(getScreen());
  const next = TABS[index + direction];
  if (index !== -1 && next) {
    goToTab(next.id);
  }
}

// Called on every screen change: highlights the tab, plays the slide.
export function renderTabs(screen, view) {
  tabbar.hidden = screen === "edit";
  document.body.classList.toggle("has-tabbar", !tabbar.hidden);
  for (const tab of tabbar.querySelectorAll(".tab")) {
    const active = tab.dataset.tab === tabOf(screen);
    tab.classList.toggle("active", active);
    if (active) {
      tab.setAttribute("aria-current", "page");
    } else {
      tab.removeAttribute("aria-current");
    }
  }
  document.body.classList.remove("sheet-closing");
  // Undo any finger-drag position left on the pages.
  for (const page of document.querySelectorAll(".view")) {
    page.style.willChange = "";
    page.style.transform = "";
    page.style.opacity = "";
    page.style.transition = "";
    // A leftover slide class would replay whenever the page reappears.
    page.classList.remove("slide-from-right", "slide-from-left");
  }
  if (view && swipeDirection !== 0) {
    const name = swipeDirection > 0 ? "slide-from-right" : "slide-from-left";
    view.classList.remove("slide-from-right", "slide-from-left");
    void view.offsetWidth; // restart the animation
    view.classList.add(name);
    view.addEventListener("animationend", () => view.classList.remove(name), { once: true });
  }
  swipeDirection = 0;
}

export function setBadge(id, count) {
  const badge = document.getElementById(id);
  badge.hidden = !count;
  badge.textContent = count > 99 ? "99+" : String(count);
}

// Where a swipe must not switch pages.
function blocksSwipe(target) {
  return Boolean(
    target.closest("input, textarea, select, .table-wrap, dialog, [contenteditable], .page-dock, .recipe-backdrop")
  );
}

function canSwipe(screen) {
  return isTabScreen(screen) || screen === "recipe" || screen === "plan";
}

// While dragging a recipe: what letting go will do.
// The words only change when the direction does: writing them on every
// finger movement made the whole page work out its layout again.
let hintSide = "";

function showHint(dx) {
  const side = dx < 0 ? "left" : "right";
  if (side !== hintSide) {
    hintSide = side;
    swipeHint.textContent = dx < 0 ? "Next recipe" : "Add to plan";
    swipeHint.classList.toggle("from-left", dx > 0);
    swipeHint.hidden = false;
  }
  swipeHint.style.opacity = String(Math.min(Math.abs(dx) / COMMIT_PX, 1));
}

function hideHint() {
  hintSide = "";
  swipeHint.hidden = true;
}

// Follows the finger down, a bit slower, as if the page were heavy.
function dragDown(view, dy) {
  view.style.transition = "none";
  view.style.transform = "translate3d(0, " + dy * 0.6 + "px, 0)";
}

// The sheet (a recipe or the cooking plan) sinks away, then it closes.
export function closeRecipeSheet() {
  if (reduceMotion.matches) {
    closeToList();
    return;
  }
  const view = currentView();
  view.style.transform = "";
  view.style.transition = "";
  document.body.classList.add("sheet-closing");
  setTimeout(closeToList, 200);
}

function currentView() {
  return document.getElementById("view-" + getScreen());
}

// Moves the page with the finger (dx pixels sideways).
// Only moves the page, so the phone can slide what it already drew.
function dragTo(view, dx) {
  view.style.transition = "none";
  view.style.transform = "translate3d(" + dx + "px, 0, 0)";
}

// While dragging, the page gets its own layer, and moves at most once per
// screen refresh however fast the finger reports.
let nextMove = null;

function moveOnNextFrame(move) {
  if (nextMove === null) {
    requestAnimationFrame(function () {
      const run = nextMove;
      nextMove = null;
      if (run) {
        run();
      }
    });
  }
  nextMove = move;
}

function cancelMove() {
  if (nextMove !== null) {
    nextMove = () => {};
  }
}

// Not far enough: the page springs back into place.
function springBack(view) {
  view.style.transition = "transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.15), opacity 0.2s ease-out";
  view.style.transform = "";
  view.style.opacity = "";
}

// Far enough: the page slides out, then the next one slides in.
function slideOut(view, direction, whenDone) {
  if (reduceMotion.matches) {
    whenDone();
    return;
  }
  // Starts at speed, so it carries on from the finger's movement.
  view.style.transition = "transform 0.18s cubic-bezier(0.3, 0.6, 0.6, 1), opacity 0.18s linear";
  // A recipe leaves whole, like a card; a page fades into the next one.
  const card = getScreen() === "recipe";
  const distance = window.innerWidth * (card ? 1.05 : 0.6);
  view.style.transform = "translate3d(" + (direction > 0 ? -1 : 1) * distance + "px, 0, 0)";
  view.style.opacity = card ? "" : "0";
  let done = false;
  const finish = function () {
    if (!done) {
      done = true;
      whenDone();
    }
  };
  view.addEventListener("transitionend", finish, { once: true });
  setTimeout(finish, 220); // in case transitionend doesn't fire
}

function hasNeighbour(direction) {
  if (getScreen() === "recipe") {
    return true;
  }
  const index = tabIndex(getScreen());
  return index !== -1 && Boolean(TABS[index + direction]);
}

function initSwipe() {
  // drag: null, or { x, y, time, axis: null | "x" | "y", view, lastX, lastTime, speed }
  let drag = null;

  document.addEventListener("touchstart", function (event) {
    drag = null;
    const touch = event.touches[0];
    if (event.touches.length !== 1 || !canSwipe(getScreen()) || document.querySelector("dialog[open]")) {
      return;
    }
    if (touch.clientX < EDGE_PX || touch.clientX > window.innerWidth - EDGE_PX || blocksSwipe(event.target)) {
      return;
    }
    const now = Date.now();
    const sheet = getScreen() === "recipe" || getScreen() === "plan";
    const atTop = sheet && currentView().scrollTop <= 0;
    drag = { x: touch.clientX, y: touch.clientY, axis: null, view: currentView(), lastX: touch.clientX, lastTime: now, speed: 0, atTop: atTop };
  }, { passive: true });

  document.addEventListener("touchmove", function (event) {
    if (!drag || event.touches.length !== 1) {
      return;
    }
    const touch = event.touches[0];
    const dx = touch.clientX - drag.x;
    const dy = touch.clientY - drag.y;
    if (!drag.axis) {
      if (Math.abs(dx) < DECIDE_PX && Math.abs(dy) < DECIDE_PX) {
        return;
      }
      // Mostly sideways: a page swipe. Down from the top of a recipe: close
      // it. Otherwise: an ordinary scroll.
      if (Math.abs(dx) > Math.abs(dy) * 1.2) {
        // The plan has no neighbours to swipe to.
        drag.axis = getScreen() === "plan" ? "none" : "x";
      } else {
        drag.axis = drag.atTop && dy > 0 ? "down" : "y";
      }
    }
    if (drag.axis === "down") {
      drag.dy = Math.max(dy, 0);
      if (!reduceMotion.matches) {
        const { view, dy: distance } = drag;
        view.style.willChange = "transform";
        moveOnNextFrame(() => dragDown(view, distance));
      }
      return;
    }
    if (drag.axis !== "x") {
      return;
    }
    const now = Date.now();
    drag.speed = (touch.clientX - drag.lastX) / Math.max(now - drag.lastTime, 1);
    drag.lastX = touch.clientX;
    drag.lastTime = now;
    const hint = getScreen() === "recipe";
    if (reduceMotion.matches) {
      if (hint) {
        showHint(dx);
      }
      return;
    }
    const direction = dx < 0 ? 1 : -1;
    const { view } = drag;
    const distance = hasNeighbour(direction) ? dx : dx * RUBBER_BAND;
    view.style.willChange = "transform";
    moveOnNextFrame(function () {
      dragTo(view, distance);
      if (hint) {
        showHint(dx);
      }
    });
  }, { passive: true });

  function release(event, cancelled) {
    if (!drag) {
      return;
    }
    const current = drag;
    drag = null;
    cancelMove();
    hideHint();
    if (current.axis === "down") {
      if (!cancelled && current.dy > CLOSE_PX) {
        closeRecipeSheet();
      } else {
        springBack(current.view);
      }
      return;
    }
    if (current.axis !== "x") {
      return;
    }
    const touch = event.changedTouches[0];
    const dx = (touch ? touch.clientX : current.lastX) - current.x;
    const direction = dx < 0 ? 1 : -1;
    const flicked = Math.abs(dx) > FLICK_PX && Math.abs(current.speed) > FLICK_SPEED && Math.sign(current.speed) === Math.sign(dx);
    const commit = !cancelled && hasNeighbour(direction) && (Math.abs(dx) > COMMIT_PX || flicked);
    if (commit && getScreen() === "recipe") {
      if (direction > 0) {
        slideOut(current.view, direction, () => recipeSwipe(direction));
      } else {
        // Adding keeps the recipe in view behind the notice.
        springBack(current.view);
        recipeSwipe(direction);
      }
    } else if (commit) {
      slideOut(current.view, direction, () => stepTab(direction));
    } else {
      springBack(current.view);
    }
  }

  document.addEventListener("touchend", (event) => release(event, false), { passive: true });
  document.addEventListener("touchcancel", (event) => release(event, true), { passive: true });
}

// screenGetter: returns the current screen name.
export function initTabs(screenGetter) {
  getScreen = screenGetter;
  for (const tab of tabbar.querySelectorAll(".tab")) {
    tab.addEventListener("click", function (event) {
      event.preventDefault();
      goToTab(tab.dataset.tab);
    });
  }
  initSwipe();
}
