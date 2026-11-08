// Keeps the phone screen on while a recipe is open, so it doesn't go dark
// with floury hands. Uses the browser's Screen Wake Lock; where that isn't
// available (older browsers), nothing happens and the screen behaves as usual.

let wanted = false;
let lock = null;

async function take() {
  if (lock || !wanted || document.visibilityState !== "visible" || !("wakeLock" in navigator)) {
    return;
  }
  try {
    lock = await navigator.wakeLock.request("screen");
    lock.addEventListener("release", () => {
      lock = null;
    });
    // Closed meanwhile? Let go straight away.
    if (!wanted) {
      letGo();
    }
  } catch {
    lock = null; // battery saver, or not allowed: the screen just dims as usual
  }
}

function letGo() {
  if (lock) {
    lock.release();
    lock = null;
  }
}

// on: true while a recipe is open.
export function keepScreenOn(on) {
  wanted = on;
  if (on) {
    take();
  } else {
    letGo();
  }
}

// The browser drops the lock when the app is hidden (another app, screen
// off); take it again on coming back.
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") {
    take();
  }
});
