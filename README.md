# Kitchen

A small kitchen management app for our household: recipes first, then meal plans and shopping lists.

Plain HTML, CSS and JavaScript modules. No build step: GitHub Pages serves the files as they are.

## Use it

Open `index.html` through a web server (or the GitHub Pages link once enabled).
To run it locally: `python -m http.server` in this folder, then open http://localhost:8000.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `N` | Add recipe |

## Files

```
index.html          page structure
css/style.css       the look (colour tokens, light + dark)
js/main.js          starts the app, wires modules together
js/version.js       APP_VERSION, bumped with every change
js/ui/shortcuts.js  all keyboard shortcuts in one table
```

## Privacy

Nothing is sent anywhere. When recipes are added, they will be stored on your own device.

## Roadmap

- Recipe form (name, ingredients in g/ml, steps) saved on the device
- Recipe list and search
- Weekly meal plan
- Shopping list generated from the plan
