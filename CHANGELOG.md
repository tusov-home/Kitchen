# Changelog

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
