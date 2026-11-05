// "Today's suggestion" at the top of the recipes page: one recipe to
// cook, with a short reason. "Another idea" steps through the day's list.
import { dailySuggestions } from "../lib/suggest.js";
import { toDateString } from "../lib/chores.js";

const box = document.getElementById("suggestion");
const label = document.getElementById("suggestion-label");
const link = document.getElementById("suggestion-link");
const reason = document.getElementById("suggestion-reason");
const openButton = document.getElementById("suggestion-open");
const nextButton = document.getElementById("suggestion-next");

const KEY = "kitchen.suggestion.v1";

// How many times "Another idea" was tapped today (on this phone).
function loadOffset(today) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    return saved.date === today ? saved.offset || 0 : 0;
  } catch (error) {
    return 0;
  }
}

function saveOffset(today, offset) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ date: today, offset: offset }));
  } catch (error) {
    // Not important enough to bother anyone about.
  }
}

let lastRecipes = [];

// visible: false while searching or planning, so the list has the stage.
export function renderSuggestion(recipes, visible) {
  lastRecipes = recipes;
  box.hidden = !visible || recipes.length === 0;
  if (box.hidden) {
    return;
  }
  const now = new Date();
  const today = toDateString(now);
  const list = dailySuggestions(recipes, today);
  const pick = list[loadOffset(today) % list.length];
  const href = "#/r/" + encodeURIComponent(pick.recipe.id);

  label.textContent = "Suggestion for " + now.toLocaleDateString("en-GB", { weekday: "long" });
  link.textContent = pick.recipe.title;
  link.href = href;
  openButton.href = href;
  reason.textContent = pick.reason;
  reason.hidden = !pick.reason;
  nextButton.hidden = list.length < 2;
}

export function initSuggestion() {
  nextButton.addEventListener("click", function () {
    const today = toDateString(new Date());
    saveOffset(today, loadOffset(today) + 1);
    renderSuggestion(lastRecipes, true);
    // A soft fade so you can see it changed.
    box.classList.remove("changed");
    void box.offsetWidth;
    box.classList.add("changed");
  });
}
