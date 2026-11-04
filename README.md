# Kitchen

Our household kitchen app: recipe book, shopping list, pantry and chores. When a recipe worked out with Claude is just how we want it, we paste it here, so we can find it again and cook it exactly the same way.

**Open it:** https://tusov-home.github.io/Kitchen/

Plain HTML, CSS and JavaScript modules. No build step: GitHub Pages serves the files as they are.

## Hosting rule

Kitchen lives in the `tusov-home` organization so it has its own web address. Part Coach sits at the root of `ttusov-art.github.io`, and an app at a site's root claims every address below it: apps placed under it can't be installed separately, and Part Coach clears their offline helpers when it starts. So: **never put an app in a `*.github.io` root repository** next to other apps.

## Use it

- **Add a recipe:** copy the recipe from Claude, press **+ Add recipe** and paste. The first line becomes the title (you can change it). Add tags like `quick, weekend, chicken`.
- **Find it again:** search by name, tag or ingredient, or tap a tag to filter.
- **Cook it:** open the recipe. **✓ Cooked today** adds the date to the notes; **Edit** lets you change anything and add notes ("less chilli next time").
- **Servings:** use **− / +** on a recipe to cook for more or fewer people. Ingredient amounts change (highlighted); the method stays as written. The base number comes from "Serves 2" in the text, or set it in **Edit → Servings**. Without it, the stepper multiplies (×½, ×1½, ×2 …).
- **Owners:** whoever adds a recipe owns it, and only they can edit or delete it. The other person can view and rate it, or tap **Make my copy** to adjust it as their own recipe; the copy links back to the original. This is a household convenience, not real security: it trusts the name each phone is set to, so keep your name the same.
- **Pages:** the tab bar at the bottom switches between **Recipes**, **Shopping**, **Pantry** and **Chores**. Swipe left or right to move between them (start the swipe a little away from the screen edge, which Android uses for Back). The small numbers show what needs attention.
- **Pantry:** what you have at home. Tap **Have** to mark something **Low**, again for **Out**. **Add to shopping list** puts everything low or out on the list, and ticking it off while shopping marks it as **Have** again. Shopping lists made from recipes put things you have under **Check you have** (the pantry doesn't know amounts, so they're not removed). Tap a name to rename it, move it to another section or delete it.
- **Chores:** **+ Add chore**, choose who (or Anyone), how often it repeats, and when it's next due. Tick it off when done: a repeating chore comes back on its next date (done a day late, it stays on its usual day), with **Undo** if you tapped by mistake. One-off chores go to **Done**; **Clear done** tidies up. Tap a chore to edit it or see who did it last.
- **Owner and sorting:** above the tags, tap a name to see only that person's recipes (Everyone shows all). **Sort** orders the list by Newest, A–Z or Best rated. Each phone remembers its choice.
- **Shopping list:** on the recipe list tap **🛒 Plan shopping**, tap the recipes you'll cook, then **Make shopping list**. Items are sorted by shop section and the same ingredient is added up (two recipes with 200 g feta → 400 g feta; "7+ tbsp olive oil" means some recipes didn't say how much). Things you probably have (salt, oil, spices) go under **Check you have**. Tick items off as you shop, ✕ to remove one, or add your own. With sync, you both see the same list and ticks. 🛒 in the top bar opens it.
- **Rate it:** tap 1–5 stars after eating. Each of you rates on your own phone (the app asks your name once; change it in ⚙). Tap the same star again to clear. The list shows the average.
## Install as an app

Kitchen can be installed like an app: own icon, full screen, opens without internet.

- **Android (Chrome):** open https://tusov-home.github.io/Kitchen/, tap **Install app** in the top bar (or ⋮ → *Install app*).
- **Windows (Chrome or Edge):** click **Install app** in the top bar, or the install icon at the right end of the address bar.
- **iPhone (Safari):** Share → *Add to Home Screen*. This also stops Safari from deleting the app's data after 7 days without use.

Updates arrive automatically: when online, the app always loads the newest version.

## Bring recipes over from Claude chats

In Claude, make sure **Settings → "Search and reference chats"** is on, start a new chat and paste:

```
Search all my past chats for recipes I worked out or adjusted. Search several times with different words (recipe, ingredients, dinner, bake, soup, salad, dessert …) until you find no new ones.

For each recipe, use the FINAL version from that chat (with all my changes), not the first draft. If a dish appears in several chats, take the newest version only.

Then make one downloadable file called kitchen-recipes.json with exactly this shape:

{"recipes": [
  {
    "title": "Dish name",
    "text": "Serves 2\n\n## Ingredients\n- 200 g ...\n- 1 onion\n\n## Method\n1. ...\n2. ...",
    "tags": ["veggie", "quick"],
    "servings": 2,
    "notes": "Adjusted with Claude, chat from <month year>"
  }
]}

Rules: amounts in grams/ml, tbsp/tsp for small amounts; one ingredient per "- " line, starting with the amount; method as numbered steps; tags in lowercase. Before making the file, show me the list of dish names you found so I can remove any I don't want.
```

Then in Kitchen: **⚙ → Import from file** and pick `kitchen-recipes.json`. The recipes are owned by whoever's phone imports them. Importing the same file again won't create doubles.

## Keyboard shortcuts

| Key | Action | Where |
|---|---|---|
| `N` | Add recipe | list, recipe |
| `/` | Search | list |
| `E` | Edit recipe (your own) | recipe |
| `C` | Make my copy | recipe |
| `1` … `5` | Rate (same again clears) | recipe |
| `+` / `−` | More / fewer servings | recipe |
| `Ctrl+S` | Save | edit form |
| `Esc` | Back / cancel | recipe, edit form |
| `P` | Plan shopping (pick recipes) | list |
| `←` / `→` | Previous / next page | Recipes, Shopping, Pantry, Chores |
| `N` | Add an item / a chore | Pantry / Chores |
| `L` | Open shopping list | list, recipe |
| `?` | Show all shortcuts | everywhere |

## Sync between phones (Google Sheet, one-time setup, ~10 minutes)

Recipes are always saved on the device first, so the app works offline. With sync set up, every phone and laptop shares the same recipes through a Google Sheet in your Drive.

1. Create a new Google Sheet, e.g. **Kitchen recipes**.
2. In the Sheet: **Extensions → Apps Script**. Delete the sample code and paste everything from [`apps-script/Code.gs`](apps-script/Code.gs). Save (`Ctrl+S`).
3. **Deploy → New deployment**. Click the gear next to *Select type* and choose **Web app**.
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
4. Press **Deploy**, allow access with your Google account (Google shows a warning because it's your own unverified script: *Advanced → Go to … (unsafe)* is expected here).
5. Copy the **Web app URL** (ends with `/exec`).
6. In the Kitchen app: **⚙ → Web app link**, paste it, press **Save and sync**. A green dot in the top bar means synced.
7. Send the same link to the other phone (e.g. in a private message) and paste it there too.

**`Code.gs` should rarely change:** it stores whole recipes without needing to know their fields. If an update ever does change it (the CHANGELOG says so), paste the new code over the old one, save, then: Deploy → Manage deployments → ✏ Edit → Version: *New version* → Deploy. The link stays the same.

Sync status dot: green = synced, amber = offline (will sync later), red = sync problem (tap ⚙ to see the message).

## Privacy

- Recipes are stored on each device (browser storage) and, with sync, in your own Google Sheet.
- **The web app link works like a password:** anyone who has it can read and change the recipes. Keep it between yourselves; it is never stored in this repository.
- Nothing else is sent anywhere. No tracking, no analytics.
- Deleted recipes leave a small marker for 90 days so the deletion reaches every phone; then the Sheet removes it.
- To delete everything: delete the recipes in the app and delete the Sheet in Google Drive.

## Files

```
index.html            page structure (all screens and dialogs)
manifest.webmanifest  app name, icons and colours for installing
sw.js                 service worker: keeps a copy of the app for offline use
icons/                app icons (Android, Windows, iPhone, browser tab)
js/pwa.js             registers the service worker, shows the Install button
css/style.css         the look (colour tokens, light + dark)
js/main.js            starts the app, wires modules together, shows the right screen
js/version.js         APP_VERSION, bumped with every change
js/state.js           the recipes in memory; the only place that changes them
js/collection.js      a small reusable store (used by pantry and chores)
js/pantryState.js     the pantry
js/choresState.js     the chores
js/shoppingState.js   the shopping list; the only place that changes it
js/storage.js         saving on the device, settings, export/import files
js/sync.js            talks to the Google Sheet
js/lib/recipes.js     pure helpers: title from text, tags, search, merging
js/lib/markdown.js    turns Claude's Markdown into safe HTML, scales the ingredients part
js/lib/scale.js       pure helpers: find servings, scale and format amounts
js/lib/sections.js    finds the ingredients part of a recipe (shared rules)
js/lib/shopping.js    pure helpers: read ingredients, shop sections, add up, merge lists
js/lib/pantry.js      pure helpers: pantry sections, statuses, matching ingredients
js/lib/chores.js      pure helpers: due dates, repeating, grouping
js/ui/router.js       which screen belongs to which address (#/r/…)
js/ui/list.js         recipe list, search, tag filter
js/ui/recipe.js       one recipe, servings stepper
js/ui/rating.js       star ratings
js/ui/name.js         whose phone this is (asked once)
js/ui/plan.js         Plan shopping mode on the recipe list
js/ui/shopping.js     the shopping list screen
js/ui/tabs.js         bottom tab bar and swiping between pages
js/ui/pantry.js       the pantry screen
js/ui/chores.js       the chores screen
js/ui/editor.js       add/edit form
js/ui/settings.js     settings dialog: sync, backup, privacy
js/ui/shortcuts.js    all keyboard shortcuts in one table
js/ui/toast.js        short pop-up messages
apps-script/Code.gs   the Google Sheet side of sync (stores each item as JSON; one tab per collection)
tests/                unit tests and browser tests (made-up recipes only)
```

## Tests

```
node --test tests/*.test.mjs     # pure helpers + Code.gs against a fake Sheet
python tests/app_test.py         # browser: Android phone + laptop with keyboard, fake Sheet
```

## Roadmap

- Weekly meal plan built from saved recipes
- Shopping list generated from the plan
- Servings scaling
- "New version available" banner
