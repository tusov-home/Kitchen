// A short message at the bottom of the screen that disappears by itself.
// action (optional): { label: "Undo", run: function } adds a button and
// keeps the message up a little longer.
const toast = document.getElementById("toast");
let timer = null;

export function showToast(message, action) {
  toast.replaceChildren(document.createTextNode(message));
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-action";
    button.textContent = action.label;
    button.addEventListener("click", function () {
      toast.hidden = true;
      action.run();
    });
    toast.appendChild(button);
  }
  toast.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(function () {
    toast.hidden = true;
  }, action ? 5000 : 2500);
}
