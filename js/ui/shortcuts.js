// All keyboard shortcuts live here, in one table: key -> action name.
const SHORTCUTS = {
  n: "addRecipe",
};

// True while the user is typing, so shortcuts don't steal their keys.
function isTyping(target) {
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

// actions: an object like { addRecipe: function () { ... } }
export function initShortcuts(actions) {
  document.addEventListener("keydown", function (event) {
    if (isTyping(event.target)) {
      return;
    }
    // Leave Ctrl/Cmd/Alt combinations to the browser.
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const actionName = SHORTCUTS[event.key.toLowerCase()];
    if (actionName && actions[actionName]) {
      event.preventDefault();
      actions[actionName]();
    }
  });
}
