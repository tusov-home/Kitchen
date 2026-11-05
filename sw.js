// Service worker: lets the installed app open without internet.
//
// Strategy "network first": when online, always load the newest files
// from GitHub Pages (so updates arrive right away) and keep a copy.
// When offline, use the copy. Recipes themselves live in localStorage,
// not here; requests to the Google Sheet are never touched.

const CACHE = "kitchen-app-v6";

const APP_FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "js/main.js",
  "js/version.js",
  "js/state.js",
  "js/storage.js",
  "js/sync.js",
  "js/shoppingState.js",
  "js/collection.js",
  "js/pantryState.js",
  "js/choresState.js",
  "js/projectsState.js",
  "js/pwa.js",
  "js/lib/recipes.js",
  "js/lib/markdown.js",
  "js/lib/scale.js",
  "js/lib/sections.js",
  "js/lib/shopping.js",
  "js/lib/pantry.js",
  "js/lib/chores.js",
  "js/lib/projects.js",
  "js/ui/router.js",
  "js/ui/list.js",
  "js/ui/recipe.js",
  "js/ui/rating.js",
  "js/ui/name.js",
  "js/ui/plan.js",
  "js/ui/shopping.js",
  "js/ui/tabs.js",
  "js/ui/pantry.js",
  "js/ui/chores.js",
  "js/ui/projects.js",
  "js/ui/project.js",
  "js/ui/editor.js",
  "js/ui/settings.js",
  "js/ui/shortcuts.js",
  "js/ui/toast.js",
  "icons/icon-192.png",
  "icons/favicon-32.png",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_FILES))
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

self.addEventListener("fetch", function (event) {
  const request = event.request;
  const url = new URL(request.url);
  // Only our own files; leave Google Sheet sync and everything else alone.
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }
  event.respondWith(
    fetch(request)
      .then(function (response) {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(function () {
        return caches.match(request, { ignoreSearch: true }).then(function (cached) {
          // Any page address falls back to the app itself.
          return cached || caches.match("./");
        });
      })
  );
});
