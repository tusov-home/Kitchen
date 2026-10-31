// Starts the app and wires the modules together.
import { APP_VERSION } from "./version.js";
import { initShortcuts } from "./ui/shortcuts.js";

const addRecipeButton = document.getElementById("add-recipe");
const statusText = document.getElementById("status");

// Placeholder until the recipe form is built in the next step.
function addRecipe() {
  statusText.textContent = "Recipe form coming soon.";
}

addRecipeButton.addEventListener("click", addRecipe);

initShortcuts({
  addRecipe: addRecipe,
});

document.getElementById("app-version").textContent = "Version " + APP_VERSION;
