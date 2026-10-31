// The shopping list data and the only place that changes it (like
// state.js does for recipes). Kept on the device and synced through
// the Sheet's "shopping" tab.
import * as storage from "./storage.js";
import { newId } from "./lib/recipes.js";
import { addRecipeItems, manualItem, mergeLists, currentList, normaliseList } from "./lib/shopping.js";

// All lists, including deleted ones (needed for sync).
let lists = storage.loadShopping().map(normaliseList).filter(Boolean);
const listeners = [];

function changed(fromSync) {
  storage.saveShopping(lists);
  for (const listener of listeners) {
    listener({ fromSync: fromSync === true });
  }
}

export function onChange(listener) {
  listeners.push(listener);
}

export function getCurrent() {
  return currentList(lists);
}

export function getAllForSync() {
  return lists;
}

// Replaces one list with a changed copy, marking it as just changed.
function update(list, changes) {
  const updated = Object.assign({}, list, changes, { updatedAt: Date.now() });
  lists = lists.filter((l) => l.id !== list.id).concat(updated);
  changed();
  return updated;
}

// recipes: [{ id, title, text, servings }]. mode "new" starts a fresh
// list (the old one is deleted); "add" adds to the current list.
export function addRecipes(recipes, mode) {
  const now = Date.now();
  let list = mode === "add" ? getCurrent() : null;
  if (!list) {
    const old = getCurrent();
    if (old) {
      lists = lists.map((l) => (l.id === old.id ? Object.assign({}, l, { deleted: true, updatedAt: now }) : l));
    }
    list = { id: newId(), createdAt: now, updatedAt: now, deleted: false, recipes: {}, items: {} };
    lists = lists.concat(list);
  }
  let items = list.items;
  const listRecipes = Object.assign({}, list.recipes);
  for (const recipe of recipes) {
    items = addRecipeItems(items, recipe, 1, now);
    listRecipes[recipe.id] = { title: recipe.title, servings: recipe.servings || null, at: now };
  }
  return update(list, { items: items, recipes: listRecipes });
}

export function toggleItem(key) {
  const list = getCurrent();
  if (!list || !list.items[key]) {
    return;
  }
  const item = list.items[key];
  const items = Object.assign({}, list.items);
  items[key] = Object.assign({}, item, { checked: !item.checked, at: Date.now() });
  update(list, { items: items });
}

// Removed items stay as small markers, so the removal syncs too.
function removeWhere(test) {
  const list = getCurrent();
  if (!list) {
    return 0;
  }
  const now = Date.now();
  const items = Object.assign({}, list.items);
  let count = 0;
  for (const [key, item] of Object.entries(items)) {
    if (!item.removed && test(item, key)) {
      items[key] = Object.assign({}, item, { removed: true, at: now });
      count++;
    }
  }
  if (count) {
    update(list, { items: items });
  }
  return count;
}

export function removeItem(key) {
  removeWhere((item, itemKey) => itemKey === key);
}

export function removeTicked() {
  return removeWhere((item) => item.checked);
}

// Adds something you typed, e.g. "toilet paper" or "2 lemons".
export function addOwnItem(text) {
  if (!text.trim()) {
    return;
  }
  const now = Date.now();
  let list = getCurrent();
  if (!list) {
    list = { id: newId(), createdAt: now, updatedAt: now, deleted: false, recipes: {}, items: {} };
    lists = lists.concat(list);
  }
  const own = manualItem(text, now);
  const items = Object.assign({}, list.items);
  // Same thing already on the list (and not ticked): keep one line.
  if (items[own.key] && !items[own.key].removed && !items[own.key].checked) {
    return;
  }
  items[own.key] = own.item;
  update(list, { items: items });
}

export function deleteCurrent() {
  const list = getCurrent();
  if (list) {
    update(list, { deleted: true });
  }
}

export function mergeIn(incoming, fromSync) {
  lists = mergeLists(lists, incoming.map(normaliseList).filter(Boolean));
  changed(fromSync);
}
