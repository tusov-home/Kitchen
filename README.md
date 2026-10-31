# Kitchen

Our household recipe book. When a recipe worked out with Claude is just how we want it, we paste it here, so we can find it again and cook it exactly the same way.

**Open it:** https://tusov-home.github.io/Kitchen/

Plain HTML, CSS and JavaScript modules. No build step: GitHub Pages serves the files as they are.

## Hosting rule

Kitchen lives in the `tusov-home` organization so it has its own web address. Part Coach sits at the root of `ttusov-art.github.io`, and an app at a site's root claims every address below it: apps placed under it can't be installed separately, and Part Coach clears their offline helpers when it starts. So: **never put an app in a `*.github.io` root repository** next to other apps.

## Use it

- **Add a recipe:** copy the recipe from Claude, press **+ Add recipe** and paste. The first line becomes the title (you can change it). Add tags like `quick, weekend, chicken`.
- **Find it again:** search by name, tag or ingredient, or tap a tag to filter.
- **Cook it:** open the recipe. **✓ Cooked today** adds the date to the notes; **Edit** lets you change anything and add notes ("less chilli next time").
- **Servings:** use **− / +** on a recipe to cook for more or fewer people. Ingredient amounts change (highlighted); the method stays as written. The base number comes from "Serves 2" in the text, or set it in **Edit → Servings**. Without it, the stepper multiplies (×½, ×1½, ×2 …).
- **Rate it:** tap 1–5 stars after eating. Each of you rates on your own phone (the app asks your name once; change it in ⚙). Tap the same star again to clear. The list shows the average.
## Install as an app

Kitchen can be installed like an app: own icon, full screen, opens without internet.

- **Android (Chrome):** open https://tusov-home.github.io/Kitchen/, tap **Install app** in the top bar (or ⋮ → *Install app*).
- **Windows (Chrome or Edge):** click **Install app** in the top bar, or the install icon at the right end of the address bar.
- **iPhone (Safari):** Share → *Add to Home Screen*. This also stops Safari from deleting the app's data after 7 days without use.

Updates arrive automatically: when online, the app always loads the newest version.

## Keyboard shortcuts

| Key | Action | Where |
|---|---|---|
| `N` | Add recipe | list, recipe |
| `/` | Search | list |
| `E` | Edit recipe | recipe |
| `1` … `5` | Rate (same again clears) | recipe |
| `+` / `−` | More / fewer servings | recipe |
| `Ctrl+S` | Save | edit form |
| `Esc` | Back / cancel | recipe, edit form |
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

**When `Code.gs` changes in an update** (the CHANGELOG says so), paste the new code over the old one, save, then: Deploy → Manage deployments → ✏ Edit → Version: *New version* → Deploy. The link stays the same.

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
js/storage.js         saving on the device, settings, export/import files
js/sync.js            talks to the Google Sheet
js/lib/recipes.js     pure helpers: title from text, tags, search, merging
js/lib/markdown.js    turns Claude's Markdown into safe HTML, scales the ingredients part
js/lib/scale.js       pure helpers: find servings, scale and format amounts
js/ui/router.js       which screen belongs to which address (#/r/…)
js/ui/list.js         recipe list, search, tag filter
js/ui/recipe.js       one recipe, servings stepper
js/ui/rating.js       star ratings, whose phone this is
js/ui/editor.js       add/edit form
js/ui/settings.js     settings dialog: sync, backup, privacy
js/ui/shortcuts.js    all keyboard shortcuts in one table
js/ui/toast.js        short pop-up messages
apps-script/Code.gs   the Google Sheet side of sync
tests/                unit tests and browser tests (made-up recipes only)
```

## Tests

```
node --test tests/*.test.mjs     # pure helpers
python tests/app_test.py         # browser: Android phone + laptop with keyboard, fake Sheet
```

## Roadmap

- Weekly meal plan built from saved recipes
- Shopping list generated from the plan
- Servings scaling
- "New version available" banner
