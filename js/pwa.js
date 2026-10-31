// Makes the website installable as an app (Android, Windows Chrome/Edge)
// and lets it open offline.

let installPrompt = null;
let listener = function () {};

// Called with true when the app can be installed, false when not (anymore).
export function onInstallAvailable(fn) {
  listener = fn;
}

export function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

// Shows the browser's own "Install Kitchen?" question.
export async function install() {
  if (!installPrompt) {
    return;
  }
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  listener(false);
}

export function initPwa() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function (error) {
      console.warn("Offline support not available", error);
    });
  }

  // Chrome fires this when the app meets the install rules.
  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault(); // we show our own button instead
    installPrompt = event;
    listener(true);
  });

  window.addEventListener("appinstalled", function () {
    installPrompt = null;
    listener(false);
  });
}
