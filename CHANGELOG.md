# Changelog

## 2026-10-31 g
- Recipes have an owner: whoever adds a recipe owns it ("Added by Kadi"). The app asks whose phone it is before the first save.
- Only the owner can edit, delete or mark "Cooked today". Others can view and rate it, and **Make my copy** to adjust it as their own recipe, linked to the original ("copy of … (Kadi)").
- Recipes from before this update have no owner; the first person to edit one becomes its owner.
- Shortcut: C to make a copy.
- Sheet sync stores owner and copy link. **Update `Code.gs` in Apps Script and deploy a new version.**

## 2026-10-31 f
- Installed app's bottom bar and start-up screen use the dark background (we both use dark mode). Reinstall the app to pick this up straight away.

## 2026-10-31 e
- Star ratings (1–5) per person: each phone asks once whose phone it is. Tap the same star again to clear. The list shows the average.
- Servings: found automatically from "Serves 2" (editable in the form). The − / + stepper on a recipe scales the ingredient amounts and highlights them; the method (temperatures, times) is never changed.
- Shortcuts: 1–5 to rate, + / − for servings.
- Sheet sync stores servings and ratings; ratings from two phones are merged person by person. **Update `Code.gs` in Apps Script and deploy a new version.**

## 2026-10-31 d
- Phone status bar and app title bar now match the page background instead of orange (light and dark mode).

## 2026-10-31 c
- Installable as an app on Android and Windows (manifest, icons, "Install app" button).
- Opens and works offline (service worker keeps a copy of the app files).

## 2026-10-31 b
- Recipe book: paste a recipe from Claude, title taken from the first line, tags and notes.
- Recipe list with search (name, tag, ingredient) and tag filter.
- Recipe view with formatted ingredients, steps and tables; "Cooked today" adds the date to the notes.
- Edit and delete recipes.
- Sync between devices through a Google Sheet (Apps Script in `apps-script/Code.gs`).
- Export/import a backup file.
- Keyboard shortcuts: N, /, E, Ctrl+S, Esc, ? (shortcut list).
- Phone Back button works between screens.

## 2026-10-31 a
- First version: landing page with an "Add recipe" button (placeholder) and the `N` shortcut.
