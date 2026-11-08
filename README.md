# Kitchen

Our household kitchen app: recipe book, shopping list, pantry and home projects. When a recipe worked out with Claude is just how we want it, we paste it here, so we can find it again and cook it exactly the same way.

**Open it:** https://tusov-home.github.io/Kitchen/

Plain HTML, CSS and JavaScript modules. No build step: GitHub Pages serves the files as they are.

## Hosting rule

Kitchen lives in the `tusov-home` organization so it has its own web address. Part Coach sits at the root of `ttusov-art.github.io`, and an app at a site's root claims every address below it: apps placed under it can't be installed separately, and Part Coach clears their offline helpers when it starts. So: **never put an app in a `*.github.io` root repository** next to other apps.

## Use it

- **Meals and sauces:** every recipe is a **Meal** or a **Sauce or condiment**; choose in the recipe form. The daily suggestion only picks meals; search covers both. Recipes from before this count as meals, and the owner can change the type.
- **Add a recipe:** copy the recipe from Claude, tap **+** next to the search box, tap the text box and paste. On the laptop, N then Ctrl+V is enough. The first line becomes the title (you can change it). Add tags like `quick, weekend, chicken`.
- **Timers:** times in a recipe ("20 min", "1 hour 30 minutes", "10–12 minutes") are underlined; tap one to start a timer, named after its step ("Roast"). Several can run at once, as chips above the bottom bar on every page: tap the clock to pause or go on, the name to open the recipe, × to stop. When time is up the chip turns green, chimes and vibrates until you tap **Done** (or press X). Timers stay on the phone that started them and survive a reload. If the app is in the background, the alarm comes when you return to it.
- **Screen stays on** while a recipe is open (Chrome on Android, Edge and Chrome on Windows), so it doesn't go dark mid-cooking. Closing the recipe lets it dim as usual.
- **Find it again:** type in the search bar at the bottom of the recipes page (name, tag or ingredient); the results open in a sheet on top while you type. Matching **pantry** items come first, each with its Have / Low / Out button, so you can mark something running low without scrolling the whole pantry. Empty the box, or close the sheet, to go back.
- **Everything opens the same way:** Meals, Sauces & condiments, search results, the cooking plan and a recipe all open as sheets on top of the recipes page. Close any of them by pulling down from the top, tapping above it, phone Back, or Esc on the laptop. A recipe opened from a list or the plan closes back to that list or plan.
- **Cook it:** open the recipe. Ticking it as cooked in the plan's review adds the date to the notes; **Edit** lets you change anything and add notes ("less chilli next time").
- **Servings:** use **− / +** on a recipe to cook for more or fewer people. Ingredient amounts change (highlighted); the method stays as written. The base number comes from "Serves 2" in the text, or set it in **Edit → Servings**. Without it, the stepper multiplies (×½, ×1½, ×2 …).
- **Owners:** whoever adds a recipe owns it, and only they can edit or delete it. The other person can view and rate it, or tap **Make my copy** to adjust it as their own recipe; the copy links back to the original. This is a household convenience, not real security: it trusts the name each phone is set to, so keep your name the same.
- **Pages:** the icons in the top bar switch between **Recipes**, **Shopping**, **Pantry**, **Projects** and **Settings**. Swipe left or right to move between them: the page follows your finger, and a short swipe or quick flick is enough (start a little away from the screen edge, which Android uses for Back). The small numbers show what needs attention.
- **Pantry categories:** tap **Categories** on the Pantry page (or press C) to add, rename, reorder and remove them; they sync between phones. Removing one moves its items to **Other**, which always stays. To move an item, tap its name.
- **Pantry:** what you have at home. Tap **Have** to mark something **Low**, again for **Out**. **Restock: add … to shopping** (at the bottom) puts everything low or out on the list, and ticking it off while shopping marks it as **Have** again. Shopping lists made from recipes put things you have under **Check you have** (the pantry doesn't know amounts, so they're not removed). Tap a name to rename it, move it to another section or delete it.
- **Projects:** home improvements with no deadline. **+ Add project**, then add **steps** (tick them off as you go) and **things to buy** (**Add to shopping list** puts them on the shared list; ticking them off there marks them bought). Set the status with 💡 Idea / 🔨 Doing / ✅ Done, and keep measurements or links in **Notes**, which save by themselves. A project opens as a sheet on top of the list; close it like a recipe (pull down, tap above, Back or Esc). You can both work on the same project at once.
- **Today's suggestion:** the recipes page opens with one dish to cook today and why it was picked. Below it are the rows **Meals** and **Sauces & condiments**; tap one to open its list (or press A or S on the laptop). Search and **+** sit in the bar at the bottom. It changes daily, favours well-rated dishes you haven't cooked lately (it reads the "Cooked …" dates in the notes) and weekend dishes on weekends. The clockwise arrow in its corner shows another idea, and the counterclockwise arrow goes back. The initials in its corner (**T**, **K**) choose whose recipes it picks from: both on means all recipes, and one always stays on. Each phone starts with its own person and remembers your choice, so the two phones can show different dishes. Tap anywhere on the card to open the dish. Once the cooking plan is shopped for, the card shows the planned meals instead ("From the cooking plan: 1 of 3", still-to-cook first), and the arrows step through them.
- **Owner, tags and sorting:** open a list and tap **Filter** at its top (or press F). Tap a name to see only that person's recipes, a tag to narrow down, and **Sort** for Newest, A–Z or Best rated. Each phone remembers its sort order.
- **Shopping list:** recipes come from the cooking plan, each at its planned servings. The list groups everything by shop section; tick things off as you buy them, and they fold away under **Ticked**. **Remove ticked** and **Start over** are at the bottom, with the box for adding anything else.
- **Swipe through recipes:** on an open recipe, swipe left for the next one, or right to add it to the cooking plan; OK on the notice brings the next, and **Cancel** takes it out again. The order follows the list you came from, or today's ideas if you opened the suggestion. Pull down from the top, tap above it, or use Back to return to the list. On the laptop: → and ←.
- **Cooking plan:** swipe a recipe right, or press P on the laptop. A **Cooking plan** row appears above Meals (P opens it); the plan opens as a sheet over the recipes, and closes like a recipe (pull down, tap above it, Back or Esc). There you set the servings for each meal and tap **Add … to shopping list**. After eating, tick what you cooked, rate it with stars and add a note, then **Finish plan**. The plan is shared between both phones.
- **Jump around a recipe:** the bar at the bottom goes straight to the notes, ingredients or method (I and M on the laptop).
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

Then in Kitchen: **Settings (last icon in the top bar) → Import from file** and pick `kitchen-recipes.json`. The recipes are owned by whoever's phone imports them. Importing the same file again won't create doubles.

## Keyboard shortcuts

| Key | Action | Where |
|---|---|---|
| `N` | Add recipe | list, recipe |
| `/` | Search | list |
| `A` | Open / close meals | list |
| `S` | Open / close sauces & condiments | list |
| `F` | Show / hide filters (opens meals first) | list |
| `T` / `K` | Suggestions: whose recipes | list |
| `E` | Edit recipe (your own) | recipe |
| `C` | Make my copy | recipe |
| `→` | Next recipe | recipe |
| `←` | Add to the plan, then next | recipe |
| `P` | Add to / take out of the plan; on Recipes: open the plan | recipe, list |
| `I` / `M` | Jump to ingredients / method | recipe |
| `Ctrl+S` | Save | edit form |
| `Esc` | Back / cancel | recipe, edit form |
| `←` / `→` | Previous / next page | Recipes, Shopping, Pantry, Projects |
| `N` | Add an item / a project | Pantry / Projects |
| `C` | Edit categories | Pantry |
| `E` | Edit project | a project |
| `L` | Open shopping list | list, recipe |
| `X` | Stop a ringing timer | everywhere |
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
6. In the Kitchen app: **Settings (last icon in the top bar) → Web app link**, paste it, press **Save and sync**. The ensō turning green in the top bar means synced.
7. Send the same link to the other phone (e.g. in a private message) and paste it there too.

**`Code.gs` should rarely change:** it stores whole recipes without needing to know their fields. If an update ever does change it (the CHANGELOG says so), paste the new code over the old one, save, then: Deploy → Manage deployments → ✏ Edit → Version: *New version* → Deploy. The link stays the same.

Sync status dot: green = synced, amber = offline (will sync later), red = sync problem (open Settings to see the message).

## Privacy

- Recipes are stored on each device (browser storage) and, with sync, in your own Google Sheet.
- **The web app link works like a password:** anyone who has it can read and change the recipes. Keep it between yourselves; it is never stored in this repository.
- Nothing else is sent anywhere. No tracking, no analytics.
- Deleted recipes leave a small marker for 90 days so the deletion reaches every phone; then the Sheet removes it.
- To delete everything: delete the recipes in the app and delete the Sheet in Google Drive.

## Files

```
CLAUDE.md             working rules for Claude sessions on this repository
index.html            page structure (all screens and dialogs)
manifest.webmanifest  app name, icons and colours for installing
sw.js                 service worker: keeps a copy of the app for offline use
icons/                app icons (Android, Windows, iPhone, browser tab) and the ensō
textures/             stone image, light and dark
tools/make_textures.py  draws that image with code (needs Python, not used by the app)
tools/make_icons.py   draws the app icons: a pot in rice paper on charred black
js/pwa.js             registers the service worker, shows the Install button
css/style.css         the look (colour tokens, light + dark)
js/main.js            starts the app, wires modules together, shows the right screen
js/version.js         APP_VERSION, bumped with every change
js/state.js           the recipes in memory; the only place that changes them
js/collection.js      a small reusable store (used by pantry and projects)
js/pantryState.js     the pantry
js/projectsState.js   home improvement projects
js/shoppingState.js   the shopping list; the only place that changes it
js/storage.js         saving on the device, settings, export/import files
js/sync.js            talks to the Google Sheet
js/lib/recipes.js     pure helpers: title from text, tags, search, merging
js/lib/markdown.js    turns Claude's Markdown into safe HTML, scales the ingredients part
js/lib/scale.js       pure helpers: find servings, scale and format amounts
js/lib/sections.js    finds the ingredients part of a recipe (shared rules)
js/lib/shopping.js    pure helpers: read ingredients, shop sections, add up, merge lists
js/lib/pantry.js      pure helpers: pantry categories, statuses, matching ingredients
js/lib/dates.js       pure helpers: dates and date labels
js/lib/projects.js    pure helpers: steps and materials, merging, progress, grouping
js/lib/suggest.js     pure helpers: today's suggestion and why
js/ui/router.js       which screen belongs to which address (#/r/…)
js/ui/list.js         recipes page rows; the meals/sauces/search sheet with filters
js/ui/suggestion.js   today's suggestion
js/ui/recipe.js       one recipe, at the planned servings
js/ui/ask.js          "Are you sure?" questions in the app's style
js/ui/haptics.js      the short vibration on a press
js/ui/plan.js         the cooking plan page and its row on Recipes
js/planState.js       the shared cooking plan
js/lib/plan.js        pure helpers: plan meals, merging, servings steps
js/ui/recipeJump.js   the bar jumping to notes, ingredients and method
js/ui/recipeQueue.js  which recipe comes next when swiping
js/ui/name.js         whose phone this is (asked once)
js/ui/shopping.js     the shopping list screen
js/ui/tabs.js         the page icons and swiping between pages
js/ui/pantry.js       the pantry screen
js/ui/pantrySections.js  the Pantry categories dialog
js/ui/projects.js     the projects list and add/edit dialog
js/ui/project.js      one project: status, steps, things to buy, notes
js/ui/editor.js       add/edit form
js/ui/settings.js     settings page: your name, sync, backup, privacy
js/ui/screenAwake.js  keeps the phone screen on while a recipe is open or a timer runs
js/ui/timers.js       tappable times in recipes, the timer chips, the chime
js/timerState.js      the timers on this phone (saved, not synced)
js/lib/timers.js      finding times in text, timer names, the clock
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

## Credits

- The stone texture is drawn by `tools/make_textures.py`, made for this app.
- The app icon (a steaming pot) is drawn by `tools/make_icons.py`, made for this app.
- Fonts: [Zen Old Mincho](https://github.com/googlefonts/zen-oldmincho) and [Zen Kaku Gothic New](https://github.com/googlefonts/zen-kakugothic) by Yoshimichi Ohira, SIL Open Font License 1.1 (licence files in `fonts/`). Self-hosted: no requests to Google.
- Icons and the ensō mark: drawn for this app.

## Roadmap

- Weekly meal plan built from saved recipes
- Shopping list generated from the plan
- Servings scaling
- "New version available" banner
