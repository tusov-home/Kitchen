// A small reusable store for a list of items (pantry, projects): kept on
// the device, changed only through these functions, synced through its
// own tab in the Sheet. Each item has an id, updatedAt and deleted.
//
// Deleted items stay as small markers so the deletion reaches the
// other phone; for the same id, the newest version wins.
import { newId } from "./lib/recipes.js";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn("Could not read " + key, error);
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Could not save " + key, error);
  }
}

// name: the Sheet tab ("pantry"); normalise(raw) returns a clean item or null.
// mergeItem(a, b) (optional): combines two versions of the same item;
// by default the newer one wins.
export function createCollection(name, normalise, mergeItem) {
  const storageKey = "kitchen." + name + ".v1";
  const loaded = readJson(storageKey, []);
  let items = (Array.isArray(loaded) ? loaded : []).map(normalise).filter(Boolean);
  const listeners = [];

  function changed(fromSync) {
    writeJson(storageKey, items);
    for (const listener of listeners) {
      listener({ fromSync: fromSync === true });
    }
  }

  return {
    name: name,

    onChange(listener) {
      listeners.push(listener);
    },

    // Items you can see (not deleted).
    getAll() {
      return items.filter((item) => !item.deleted);
    },

    get(id) {
      return items.find((item) => item.id === id && !item.deleted) || null;
    },

    getAllForSync() {
      return items;
    },

    // Adds a new item (no id) or replaces one. Returns the saved item.
    put(item) {
      const saved = normalise(Object.assign({}, item, {
        id: item.id || newId(),
        updatedAt: Date.now(),
        deleted: false,
      }));
      items = items.filter((i) => i.id !== saved.id).concat(saved);
      changed();
      return saved;
    },

    // Changes some fields of one item.
    update(id, changes) {
      const item = this.get(id);
      return item ? this.put(Object.assign({}, item, changes)) : null;
    },

    remove(id) {
      items = items
        .filter((i) => i.id !== id)
        .concat({ id: id, updatedAt: Date.now(), deleted: true });
      changed();
    },

    // Items from the Sheet or a backup: the newest version of each wins.
    mergeIn(incoming, fromSync) {
      const byId = new Map(items.map((i) => [i.id, i]));
      for (const raw of incoming) {
        const item = raw && raw.deleted ? { id: String(raw.id), updatedAt: Number(raw.updatedAt) || 0, deleted: true } : normalise(raw);
        if (!item || !item.id) {
          continue;
        }
        const existing = byId.get(item.id);
        if (!existing) {
          byId.set(item.id, item);
        } else if (mergeItem && !existing.deleted && !item.deleted) {
          byId.set(item.id, mergeItem(existing, item));
        } else if (item.updatedAt > existing.updatedAt) {
          byId.set(item.id, item);
        }
      }
      items = [...byId.values()];
      changed(fromSync);
    },
  };
}
