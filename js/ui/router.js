// Which screen is shown is decided by the address after "#":
//   #/            recipe list
//   #/new         add recipe
//   #/r/<id>      one recipe
//   #/r/<id>/edit edit recipe
//   #/copy/<id>   new recipe, starting as a copy of another one
// Using the address means the phone's Back button works as expected.

// How many app screens lie behind the current one in the history.
// Stored in history.state, so it stays right after Back/Forward too.
let depth = 0;
let replacing = false;

export function parseRoute(hash) {
  const path = (hash || "").replace(/^#/, "") || "/";
  if (path === "/new") {
    return { screen: "edit", id: null };
  }
  const copy = path.match(/^\/copy\/([^/]+)$/);
  if (copy) {
    return { screen: "edit", id: null, copyFrom: decodeURIComponent(copy[1]) };
  }
  const match = path.match(/^\/r\/([^/]+)(\/edit)?$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    return { screen: match[2] ? "edit" : "recipe", id: id };
  }
  return { screen: "list", id: null };
}

// Call on page load and on every hash change.
export function trackHistory() {
  const saved = history.state && typeof history.state.depth === "number" ? history.state.depth : null;
  if (saved !== null) {
    depth = saved; // came here with Back/Forward
  } else {
    if (!replacing && document.readyState === "complete") {
      depth++; // a new screen was opened
    }
    history.replaceState({ depth: depth }, "");
  }
  replacing = false;
}

// Goes to a screen. replace = true swaps the current history entry,
// so Back doesn't return to e.g. a form that was just saved.
export function go(hash, replace) {
  if (location.hash === hash) {
    return;
  }
  if (replace) {
    replacing = true;
    location.replace(hash);
  } else {
    location.hash = hash;
  }
}

// Back within the app; if the app was opened directly on this screen,
// go to the fallback instead of leaving the app.
export function goBack(fallback) {
  if (depth > 0) {
    history.back();
  } else {
    go(fallback || "#/", true);
  }
}
