# Working on Kitchen

Notes for Claude sessions on this repository. Read this first; the README
explains the app itself (features, files, shortcuts, sync setup).

## The app and the people

- Household app for Tõnis and his wife Kristiina: recipe book, shared
  shopping list, pantry and home improvement projects.
- Live at https://tusov-home.github.io/Kitchen/ (GitHub Pages, deployed
  from branch `main`, folder `/`). Installed as an app on both phones.
- Devices: Tõnis has an Android phone (Chrome) and a Windows laptop
  (Chrome/Edge, uses keyboard shortcuts a lot). Both use **dark mode**.
- Tõnis wants to learn as we go: end each change with a short
  "What changed, and why" (files touched, one new concept explained
  plainly). Keep answers short and practical. Ask 1–4 questions before
  bigger features; build small clear changes straight away.

## Rules for every change

1. **No build step.** Plain HTML/CSS and native ES modules, served as-is.
   One job per module; UI modules never touch storage directly (they go
   through `state.js`, `shoppingState.js` or a `createCollection` store).
   Pure logic goes in `js/lib/` with unit tests.
2. **Bump `APP_VERSION`** in `js/version.js` (date + letter, must always
   increase, e.g. `2026-11-05 d` → `2026-11-05 e`, new day → `… a`) and add
   a CHANGELOG entry. The letter shows next to the title, so Tõnis can see
   when his phone has the new version.
3. **New file? Add it to `APP_FILES` in `sw.js`** and bump `CACHE`
   (`kitchen-app-vN`). Check with:
   `for f in $(find js -name "*.js"); do grep -q "\"$f\"" sw.js || echo "missing $f"; done`
4. **Run the tests** before pushing:
   - `node --test tests/*.test.mjs` (pure helpers + `Code.gs` on a fake Sheet)
   - `python3 tests/app_test.py <screenshot-folder>` (Playwright: Android
     phone profile, laptop with keyboard, two devices syncing through a
     fake Sheet, offline, site answering 404). Run it twice for flakiness.
   - For layout changes, take screenshots (dark and light, widths 340,
     360, 412 px) and look at them. No sideways scrolling allowed.
5. **Update the README** (features, shortcuts, files list) when behaviour
   or files change.
6. Tõnis has given standing permission: commit and push to `main` without
   asking, using the attribution lines from the session. Then **wait for
   the "pages build and deployment" run to finish and tell him the result**
   (green, or red with the failed step). Find the run for the commit with:
   `gh run list -R tusov-home/kitchen --commit "$(git rev-parse HEAD)" --json status,conclusion,databaseId`
   `gh run list` and `gh run view` work from a session; `gh api .../pages`
   and fetching the live site from the shell are blocked, so judge by the
   run. It can take a minute before the run appears.

## Data and sync (don't break these)

- Local-first: everything is saved on the phone (`localStorage`, keys
  `kitchen.*.v1`), then synced with a Google Sheet through
  `apps-script/Code.gs`. Never rename storage keys or fields without a
  migration; old data must keep loading.
- `Code.gs` is field-agnostic: one Sheet tab per collection (`Recipes`,
  `shopping`, `pantry`, `pantry-sections`, `projects`), each item stored as
  JSON. A `chores`
  tab may remain from a removed feature; the app no longer reads it.
  New fields and new collections need **no script change**. If a change
  ever does need it, say so clearly — Tõnis has to paste it by hand.
- Merging: the newest version of an item wins (`updatedAt`), but maps of
  timestamped entries (`{ key: { …, at } }` — ratings, shopping items,
  project steps/materials) merge entry by entry. Deletions are kept as
  `deleted` markers so they reach the other phone.
- Ownership: whoever adds a recipe owns it; only `canEdit()` in
  `js/lib/recipes.js` decides who may edit. Others view, rate, copy.

## Look and feel (Japandi)

- Colours only through the tokens at the top of `css/style.css` (stone,
  sumi ink, moss, hinoki wood; dark = charred wood + rice paper). No
  cream + orange, no emoji, thin line SVG icons, titles in Zen Old
  Mincho, text in Zen Kaku Gothic New (self-hosted in `fonts/`, OFL).
- Materials give the depth: stone walls and panels lit from above, deep
  leaf green on main buttons and pop-ups. The texture comes from
  `tools/make_textures.py` and lives in `textures/` (light + dark). We tried
  a plant (took too much attention) and timber bars (felt like a game), so
  no pictures and no wood.
- The brushed ensō (`icons/enso-mark.png`, used as a CSS mask) is the one
  signature element. Keep everything else quiet: no all-caps labels,
  generous spacing, soft rectangles rather than pills.
- Recipes page order: today's suggestion → search with + on the right →
  framed "Meals" and "Sauces & condiments" rows, filling the phone's height
  while folded. List and Filter fold behind the open row. Plan shopping
  starts on the Shopping page.
- Dialogs and the recipe form must not pop up the phone keyboard on open:
  the heading takes the focus (`tabindex="-1"`), never a text box.
- Every frequent action gets a keyboard shortcut in `js/ui/shortcuts.js`
  (never while typing, except Esc / Ctrl+S); list them in the README.

## Hosting lessons

- Kitchen lives in the `tusov-home` organization on purpose. Tõnis's
  Part Coach app sits at the root of `ttusov-art.github.io` and claims
  every address below it. **Never put an app in a `*.github.io` root
  repository** next to other apps.
- If a Pages deploy fails with "in progress deployment … please cancel":
  delete the `github-pages` environment (Settings → Environments), then
  push again. Do **not** set Pages to "None" — that takes the site down.
- GitHub Pages lets browsers keep files for 10 minutes. The service worker
  must fetch with `cache: "no-cache"`, or a phone mixes a new `index.html`
  with old JS and CSS right after a publish. `test_update_after_publish`
  guards this.
- The service worker serves its saved copy if the site answers with an
  error, so the installed app survives short outages.

## Test-writing lessons

- Don't click the page background to leave a text box (it may hit a
  recipe card); use `document.activeElement.blur()`.
- Hidden screens keep old content: wait for the screen itself
  (`#view-recipe` visible) before checking its text.
- Init scripts that seed `localStorage` must only do so when it's empty,
  or every reload resets the test phone.
- Selectors for buttons: scope them (`#edit-form button[type=submit]`) —
  several forms have submit buttons.
