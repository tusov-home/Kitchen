// A very short vibration when you press something. Android only: other
// devices simply don't have navigator.vibrate, and nothing happens.
const TOUCHABLE = "button, a, summary, input[type=checkbox], input[type=radio], label";

export function buzz() {
  if (navigator.vibrate) {
    navigator.vibrate(12);
  }
}

export function initHaptics() {
  document.addEventListener("click", function (event) {
    const target = event.target.closest(TOUCHABLE);
    if (target && !target.disabled) {
      buzz();
    }
  }, true);
}
