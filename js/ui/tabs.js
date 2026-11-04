// Bottom tab bar: Recipes · Shopping · Pantry · Chores. Tap a tab, swipe
// left/right anywhere on a page, or press ← / → on the laptop.
import { go, goBack } from "./router.js";

export const TABS = [
  { screen: "list", hash: "#/" },
  { screen: "shopping", hash: "#/shopping" },
  { screen: "pantry", hash: "#/pantry" },
  { screen: "chores", hash: "#/chores" },
];

const tabbar = document.getElementById("tabbar");

// Android uses the outer edges for its own Back gesture; leave them alone.
const EDGE_PX = 24;
const MIN_SWIPE_PX = 70;
const MAX_SWIPE_MS = 700;

let getScreen = () => "list";
let swipeDirection = 0; // -1: came from the left, +1: from the right

export function isTabScreen(screen) {
  return TABS.some((tab) => tab.screen === screen);
}

function tabIndex(screen) {
  return TABS.findIndex((tab) => tab.screen === screen);
}

// Moving between tabs. To keep the phone's Back button sensible:
// from Recipes, a tab opens on top (Back returns to Recipes); between
// the other tabs, the page is swapped (Back still returns to Recipes);
// going to Recipes steps back.
export function goToTab(screen) {
  const from = getScreen();
  const target = TABS[tabIndex(screen)];
  if (!target || from === screen) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const fromIndex = tabIndex(from);
  swipeDirection = fromIndex === -1 ? 0 : tabIndex(screen) > fromIndex ? 1 : -1;
  if (screen === "list") {
    goBack("#/");
  } else if (isTabScreen(from) && from !== "list") {
    go(target.hash, true);
  } else {
    go(target.hash);
  }
}

// +1 = next tab, -1 = previous tab. Stops at the ends.
export function stepTab(direction) {
  const index = tabIndex(getScreen());
  const next = TABS[index + direction];
  if (index !== -1 && next) {
    goToTab(next.screen);
  }
}

// Called on every screen change: highlights the tab, plays the slide.
export function renderTabs(screen, view) {
  tabbar.hidden = screen === "edit";
  document.body.classList.toggle("has-tabbar", !tabbar.hidden);
  for (const tab of tabbar.querySelectorAll(".tab")) {
    const active = tab.dataset.tab === screen || (screen === "recipe" && tab.dataset.tab === "list");
    tab.classList.toggle("active", active);
    if (active) {
      tab.setAttribute("aria-current", "page");
    } else {
      tab.removeAttribute("aria-current");
    }
  }
  if (view && swipeDirection !== 0) {
    const name = swipeDirection > 0 ? "slide-from-right" : "slide-from-left";
    view.classList.remove("slide-from-right", "slide-from-left");
    void view.offsetWidth; // restart the animation
    view.classList.add(name);
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
    target.closest("input, textarea, select, .table-wrap, dialog, [contenteditable]")
  );
}

function initSwipe() {
  let start = null;
  document.addEventListener("touchstart", function (event) {
    const touch = event.touches[0];
    if (event.touches.length !== 1 || !isTabScreen(getScreen()) || document.querySelector("dialog[open]")) {
      start = null;
      return;
    }
    if (touch.clientX < EDGE_PX || touch.clientX > window.innerWidth - EDGE_PX || blocksSwipe(event.target)) {
      start = null;
      return;
    }
    start = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, { passive: true });

  document.addEventListener("touchend", function (event) {
    if (!start) {
      return;
    }
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const quick = Date.now() - start.time < MAX_SWIPE_MS;
    start = null;
    // Clearly sideways, long enough, and quick: not a scroll or a tap.
    if (quick && Math.abs(dx) > MIN_SWIPE_PX && Math.abs(dx) > 2 * Math.abs(dy)) {
      stepTab(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
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
