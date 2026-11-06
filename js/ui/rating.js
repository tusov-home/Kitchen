// Star ratings: the Rate button opens your own stars to tap, and everyone's
// ratings listed. Anyone can rate any recipe.
import * as state from "../state.js";
import { ratingList } from "../lib/recipes.js";
import { getMyName, withMyName } from "./name.js";
import { showToast } from "./toast.js";

const myLabel = document.getElementById("my-rating-label");
const myStars = document.getElementById("my-stars");
const allRatings = document.getElementById("all-ratings");
const dialog = document.getElementById("rate-dialog");
const openButton = document.getElementById("rate-open");
const openLabel = document.getElementById("rate-open-label");

let currentRecipe = null;

function starText(stars) {
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}

export function renderRating(recipe) {
  currentRecipe = recipe;
  const name = getMyName();
  const mine = name && recipe.ratings[name] ? recipe.ratings[name].stars : 0;

  myLabel.textContent = name ? name + "'s rating" : "Your rating";
  openLabel.textContent = mine ? mine + " of 5" : "Rate";
  openButton.classList.toggle("rated", mine > 0);
  myStars.replaceChildren();
  for (let stars = 1; stars <= 5; stars++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "star" + (stars <= mine ? " filled" : "");
    button.textContent = stars <= mine ? "★" : "☆";
    button.setAttribute("aria-label", stars + (stars === 1 ? " star" : " stars"));
    button.setAttribute("aria-pressed", stars === mine ? "true" : "false");
    button.title = stars === mine ? "Tap again to clear (" + stars + ")" : stars + " of 5 (" + stars + ")";
    button.addEventListener("click", function () {
      dialog.close();
      rate(stars);
    });
    myStars.appendChild(button);
  }

  // Everyone's ratings, e.g. "Kadi ★★★★★ · Tõnis ★★★★☆"
  allRatings.replaceChildren();
  const list = ratingList(recipe);
  list.forEach(function (rating, index) {
    if (index > 0) {
      allRatings.append(" · ");
    }
    const who = document.createElement("span");
    who.className = "rater";
    who.textContent = rating.name + " ";
    const stars = document.createElement("span");
    stars.className = "rater-stars";
    stars.textContent = starText(rating.stars);
    stars.setAttribute("aria-label", rating.stars + " of 5 stars");
    allRatings.append(who, stars);
  });
  // Only worth showing once someone other than you has rated.
  allRatings.hidden = !list.some((rating) => rating.name !== name);
}

// Tapping your current number of stars again clears the rating.
export function rate(stars) {
  if (!currentRecipe) {
    return;
  }
  const recipeId = currentRecipe.id;
  withMyName(function (name) {
    const recipe = state.getRecipe(recipeId);
    if (!recipe) {
      return;
    }
    const mine = recipe.ratings[name] ? recipe.ratings[name].stars : 0;
    const newStars = mine === stars ? 0 : stars;
    state.setRating(recipeId, name, newStars);
    showToast(newStars ? "Rated " + starText(newStars) : "Rating cleared");
  });
}

export function openRating() {
  dialog.showModal();
}

export function initRating() {
  openButton.addEventListener("click", openRating);
}
