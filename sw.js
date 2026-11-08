// Service worker: lets the installed app open without internet.
//
// Strategy "network first": when online, always load the newest files
// from GitHub Pages (so updates arrive right away) and keep a copy.
// When offline, use the copy. Recipes themselves live in localStorage,
// not here; requests to the Google Sheet are never touched.
//
// GitHub Pages lets browsers keep each file for 10 minutes. "No-cache"
// below means: always ask the site whether a file changed. Without it, a
// phone can get a new page together with old code and styling.

const CACHE = "kitchen-app-v24";

const APP_FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "fonts/fonts.css",
  "fonts/zen-old-mincho-latin-400-normal.woff2",
  "fonts/zen-old-mincho-latin-700-normal.woff2",
  "fonts/zen-kaku-gothic-new-latin-400-normal.woff2",
  "fonts/zen-kaku-gothic-new-latin-500-normal.woff2",
  "fonts/zen-kaku-gothic-new-latin-700-normal.woff2",
  "js/main.js",
  "js/version.js",
  "js/state.js",
  "js/storage.js",
  "js/sync.js",
  "js/shoppingState.js",
  "js/collection.js",
  "js/pantryState.js",
  "js/planState.js",
  "js/projectsState.js",
  "js/pwa.js",
  "js/lib/recipes.js",
  "js/lib/markdown.js",
  "js/lib/scale.js",
  "js/lib/sections.js",
  "js/lib/shopping.js",
  "js/lib/pantry.js",
  "js/lib/plan.js",
  "js/lib/dates.js",
  "js/lib/projects.js",
  "js/lib/suggest.js",
  "js/ui/router.js",
  "js/ui/list.js",
  "js/ui/suggestion.js",
  "js/ui/recipe.js",
  "js/ui/ask.js",
  "js/ui/haptics.js",
  "js/ui/plan.js",
  "js/ui/recipeJump.js",
  "js/ui/recipeQueue.js",
  "js/ui/name.js",
  "js/ui/shopping.js",
  "js/ui/tabs.js",
  "js/ui/pantry.js",
  "js/ui/pantrySections.js",
  "js/ui/projects.js",
  "js/ui/project.js",
  "js/ui/editor.js",
  "js/ui/settings.js",
  "js/ui/screenAwake.js",
  "js/ui/timers.js",
  "js/timerState.js",
  "js/lib/timers.js",
  "js/lib/methodAmounts.js",
  "js/ui/shortcuts.js",
  "js/ui/toast.js",
  "icons/icon-192.png",
  "icons/enso-mark.png",
  "textures/stone-light.webp",
  "textures/stone-dark.webp",
  "icons/favicon-32.png",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(APP_FILES.map((file) => new Request(file, { cache: "reload" })))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  // Remove caches from older versions of this file.
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// The saved copy of a file; any page address falls back to the app itself.
function fromCache(request) {
  return caches.match(request, { ignoreSearch: true }).then(function (cached) {
    return cached || (request.mode === "navigate" ? caches.match("./") : undefined);
  });
}

self.addEventListener("fetch", function (event) {
  const request = event.request;
  const url = new URL(request.url);
  // Only our own files; leave Google Sheet sync and everything else alone.
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }
  event.respondWith(
    fetch(request, { cache: "no-cache" })
      .then(function (response) {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        }
        // The site answered with an error (e.g. 404 while GitHub Pages
        // is being republished): keep using the saved copy if we have one.
        return fromCache(request).then((cached) => cached || response);
      })
      .catch(function () {
        // No connection at all: use the saved copy.
        return fromCache(request);
      })
  );
});
