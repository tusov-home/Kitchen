// A short message at the bottom of the screen that disappears by itself.
const toast = document.getElementById("toast");
let timer = null;

export function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(function () {
    toast.hidden = true;
  }, 2500);
}
