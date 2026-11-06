"""Browser tests (Playwright, Python).

Run from the repository folder:
    python tests/app_test.py [screenshot-folder]

Starts a local web server, tests on an Android phone profile (Pixel 7)
and a Windows laptop size with the keyboard, and fakes the Google Sheet
so sync can be tested without the internet. Made-up recipes only.
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

PORT = 8766
BASE = f"http://localhost:{PORT}/"
SHOTS = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("test-screenshots")
SHOTS.mkdir(parents=True, exist_ok=True)
SHEET_URL = "https://script.google.com/macros/s/FAKE/exec"

RECIPE = """# Miso Aubergine with Soba

Serves 2 · 25 minutes

## Ingredients
- 2 aubergines
- 2 tbsp white miso
- 200 g soba noodles

| Item | Amount |
|---|---|
| Sesame | 1 tbsp sesame |

## Method
1. Halve the aubergines and score them.
2. Roast at 220 °C for 20 minutes.
3. Brush with **miso glaze** and grill.
"""


class FakeSheet:
    """Acts like the Apps Script web app (new Code.gs): one store per
    collection; newest item wins, timestamped maps merge entry by entry."""

    def __init__(self):
        self.stores = {"recipes": {}, "shopping": {}}
        self.calls = 0

    @property
    def recipes(self):
        return self.stores["recipes"]

    @property
    def shopping(self):
        return self.stores["shopping"]

    @staticmethod
    def is_timestamped_map(value):
        return (isinstance(value, dict) and value
                and all(isinstance(v, dict) and isinstance(v.get("at"), (int, float)) for v in value.values()))

    def merge(self, old, new):
        winner = dict(new if new["updatedAt"] > old["updatedAt"] else old)
        if winner.get("deleted"):
            return winner
        for field in set(old) | set(new):
            a, b = old.get(field), new.get(field)
            if self.is_timestamped_map(a) or self.is_timestamped_map(b):
                merged = dict(a or {})
                for key, entry in (b or {}).items():
                    if key not in merged or entry["at"] > merged[key]["at"]:
                        merged[key] = entry
                winner[field] = merged
        return winner

    def handle(self, route):
        self.calls += 1
        body = json.loads(route.request.post_data)
        collection = body.get("collection", "recipes")
        store = self.stores.setdefault(collection, {})
        for item in body.get("items", body.get("recipes", [])):
            old = store.get(item["id"])
            store[item["id"]] = item if not old else self.merge(old, item)
        items = list(store.values())
        route.fulfill(
            status=200,
            content_type="application/json",
            headers={"Access-Control-Allow-Origin": "*"},
            body=json.dumps({"ok": True, "items": items, collection: items}),
        )


def watch_errors(page, errors):
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)


def test_phone(p, sheet):
    errors = []
    ctx = p.chromium.launch().new_context(**p.devices["Pixel 7"])
    ctx.route(SHEET_URL, sheet.handle)
    page = ctx.new_page()
    watch_errors(page, errors)
    page.goto(BASE)

    expect(page.locator("#empty-list")).to_be_visible()
    page.screenshot(path=SHOTS / "phone-1-empty.png")

    # Add a recipe by pasting
    page.click("#add-recipe")
    expect(page.locator("#edit-heading")).to_be_focused()  # keyboard stays closed
    page.fill("#edit-text", RECIPE)
    expect(page.locator("#edit-title")).to_have_value("Miso Aubergine with Soba")
    page.fill("#edit-tags", "Quick, vegetarian")
    page.screenshot(path=SHOTS / "phone-2-edit.png")
    page.click("#edit-form button[type=submit]")

    # First save asks whose phone this is; the recipe is then Kadi's
    expect(page.locator("#name-dialog")).to_be_visible()
    page.fill("#name-input", "Kadi")
    page.click("#name-form button[type=submit]")
    expect(page.locator("#recipe-owner")).to_have_text("Added by Kadi")

    expect(page.locator("#recipe-title")).to_have_text("Miso Aubergine with Soba")
    assert page.locator("#recipe-body h1").count() == 0, "title must not repeat"
    expect(page.locator("#recipe-body ol li")).to_have_count(3)
    expect(page.locator("#recipe-body table")).to_be_visible()
    page.click("#cooked-today")
    expect(page.locator("#recipe-notes")).to_contain_text("Cooked")

    # Rating (name is already known)
    page.locator("#my-stars .star").nth(3).click()
    expect(page.locator("#my-stars .star.filled")).to_have_count(4)
    expect(page.locator("#my-rating-label")).to_have_text("Kadi's rating")
    expect(page.locator("#all-ratings")).to_contain_text("Kadi")

    # Servings: found "Serves 2", step up to 4 → ingredients double, method doesn't
    expect(page.locator("#servings-label")).to_have_text("2 servings")
    page.click("#servings-up")
    page.click("#servings-up")
    expect(page.locator("#servings-label")).to_have_text("4 servings")
    body = page.locator("#recipe-body")
    expect(body).to_contain_text("4 aubergines")
    expect(body).to_contain_text("400 g soba noodles")
    expect(body).to_contain_text("2 tbsp sesame")
    expect(body).to_contain_text("Roast at 220 °C for 20 minutes")
    page.screenshot(path=SHOTS / "phone-3-recipe.png", full_page=True)
    page.click("#servings-reset")
    expect(page.locator("#servings-label")).to_have_text("2 servings")
    expect(body).to_contain_text("2 aubergines")

    # Phone Back button goes to the list, not back to the form
    page.go_back()
    expect(page.locator("#view-list")).to_be_visible()
    expect(page.locator(".recipe-card")).to_have_count(1)

    # Set up sync
    page.click("#open-settings")
    page.fill("#sync-url", SHEET_URL)
    page.click("#sync-save")
    expect(page.locator("#settings-sync-status")).to_contain_text("Synced")
    page.screenshot(path=SHOTS / "phone-4-settings.png")
    page.keyboard.press("Escape")
    assert len(sheet.recipes) == 1, "recipe reached the Sheet"

    # Survives a reload (stored on the device)
    page.reload()
    expect(page.locator(".recipe-card")).to_have_count(1)
    page.screenshot(path=SHOTS / "phone-5-list.png")

    # Buttons fit at narrow widths
    for width in (340, 360, 412):
        page.set_viewport_size({"width": width, "height": 800})
        overflow = page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
        assert not overflow, f"horizontal scroll at {width}px"

    assert not errors, errors
    print("phone: ok")


def test_laptop_second_device(p, sheet):
    """Laptop opens the app fresh, syncs, then edits with the keyboard."""
    errors = []
    ctx = p.chromium.launch().new_context(viewport={"width": 1366, "height": 768})
    ctx.route(SHEET_URL, sheet.handle)
    ctx.add_init_script(
        f"if (!localStorage.getItem('kitchen.settings.v1')) localStorage.setItem('kitchen.settings.v1', JSON.stringify({{syncUrl: '{SHEET_URL}', myName: 'Tõnis'}}))"
    )
    page = ctx.new_page()
    watch_errors(page, errors)
    page.goto(BASE)

    # The recipe from the phone arrives through the Sheet
    expect(page.locator(".recipe-card")).to_have_count(1)
    expect(page.locator("#sync-status")).to_have_attribute("data-state", "ok")

    # Tõnis rates the same recipe with the keyboard; both ratings are kept
    page.click("#all-toggle")
    page.click(".recipe-card")
    expect(page.locator("#view-recipe")).to_be_visible()
    expect(page.locator("#all-ratings")).to_contain_text("Kadi")
    page.keyboard.press("5")
    expect(page.locator("#all-ratings")).to_contain_text("Tõnis")
    expect(page.locator("#all-ratings")).to_contain_text("Kadi")
    page.keyboard.press("+")
    expect(page.locator("#servings-label")).to_have_text("3 servings")
    page.keyboard.press("-")
    expect(page.locator("#servings-label")).to_have_text("2 servings")
    page.keyboard.press("Escape")
    expect(page.locator(".card-stars")).to_have_text("★ 4.5")
    page.wait_for_timeout(2500)  # sync runs shortly after a change
    synced = list(sheet.recipes.values())[0]["ratings"]
    assert set(synced) == {"Kadi", "Tõnis"}, synced

    # Kadi's recipe is view-only for Tõnis: no Edit, but "Make my copy"
    page.click(".recipe-card")
    expect(page.locator("#view-recipe")).to_be_visible()
    expect(page.locator("#recipe-owner")).to_have_text("Added by Kadi")
    expect(page.locator("#edit-link")).to_be_hidden()
    expect(page.locator("#cooked-today")).to_be_hidden()
    page.keyboard.press("e")
    expect(page.locator("#toast")).to_contain_text("Only the owner")
    expect(page.locator("#view-recipe")).to_be_visible()
    # Opening the edit address directly is refused too
    page.goto(page.url + "/edit")
    expect(page.locator("#view-recipe")).to_be_visible()
    expect(page.locator("#view-edit")).to_be_hidden()

    # Copy it and adjust: becomes Tõnis's own recipe, linked to the original
    page.keyboard.press("c")
    expect(page.locator("#edit-heading")).to_have_text("Make your copy")
    expect(page.locator("#edit-based-on")).to_contain_text("by Kadi")
    page.fill("#edit-title", "Spicy Miso Aubergine")
    page.keyboard.press("Control+s")
    expect(page.locator("#recipe-title")).to_have_text("Spicy Miso Aubergine")
    owner = page.locator("#recipe-owner")
    expect(owner).to_contain_text("Added by Tõnis")
    expect(owner).to_contain_text("copy of Miso Aubergine with Soba (Kadi)")
    expect(page.locator("#edit-link")).to_be_visible()
    expect(page.locator("#all-ratings")).to_be_hidden()  # a copy starts unrated
    expect(page.locator("#recipe-body")).not_to_contain_text("Miso Aubergine with Soba")
    page.screenshot(path=SHOTS / "laptop-0-copy.png")
    page.click(".brand")
    expect(page.locator(".recipe-card")).to_have_count(2)
    expect(page.locator(".card-owner")).to_have_count(2)

    # Keyboard: / search, N new, Ctrl+S save, Esc back, E edit, ? help
    page.keyboard.press("/")
    page.keyboard.type("zzz")
    expect(page.locator("#no-results")).to_be_visible()
    page.fill("#search", "")
    page.evaluate("document.activeElement.blur()")  # leave the text box

    page.keyboard.press("n")
    expect(page.locator("#view-edit")).to_be_visible()
    expect(page.locator("#edit-heading")).to_be_focused()
    # Ctrl+V straight away lands in the text box and fills in the title
    page.evaluate("""() => {
        const data = new DataTransfer();
        data.setData("text", "Pasted title");
        document.activeElement.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    }""")
    expect(page.locator("#edit-text")).to_have_value("Pasted title")
    expect(page.locator("#edit-title")).to_have_value("Pasted title")
    page.fill("#edit-text", "")
    page.locator("#edit-heading").focus()
    page.keyboard.press("Tab")  # Tab goes to the text box
    page.keyboard.type("Beef Shakshuka\n\n- 300 g beef mince\n- 4 eggs")
    page.fill("#edit-tags", "weekday")
    page.keyboard.press("Control+s")
    expect(page.locator("#recipe-title")).to_have_text("Beef Shakshuka")

    page.keyboard.press("e")
    expect(page.locator("#edit-heading")).to_have_text("Edit recipe")
    page.fill("#edit-notes", "Less chilli next time")
    page.keyboard.press("Control+s")
    expect(page.locator("#recipe-notes")).to_have_text("Less chilli next time")

    page.keyboard.press("Escape")
    expect(page.locator("#view-list")).to_be_visible()
    expect(page.locator(".recipe-card")).to_have_count(3)

    # Today's suggestion is the first thing on the page
    suggestion = page.locator("#suggestion")
    expect(suggestion).to_be_visible()
    expect(page.locator("#suggestion-label")).to_contain_text("Suggestion for")
    first = page.locator("#suggestion-link").inner_text()
    page.click("#suggestion-next")
    expect(page.locator("#suggestion-link")).not_to_have_text(first)
    # Search: the suggestion steps aside while typing
    page.keyboard.press("/")
    page.keyboard.type("shak")
    expect(suggestion).to_be_hidden()
    expect(page.locator("#recipe-count")).to_have_text("1 of 3")
    page.fill("#search", "")
    expect(suggestion).to_be_visible()
    page.evaluate("document.activeElement.blur()")  # leave the text box
    # Open the suggested recipe
    picked = page.locator("#suggestion-link").inner_text()
    page.click("#suggestion-open")
    expect(page.locator("#view-recipe")).to_be_visible()  # wait for the page itself
    expect(page.locator("#recipe-title")).to_have_text(picked)
    page.keyboard.press("Escape")
    expect(page.locator("#view-list")).to_be_visible()

    # Filters are folded away until asked for (F or the Filter button)
    expect(page.locator("#filter-panel")).to_be_hidden()
    page.keyboard.press("f")
    expect(page.locator("#filter-panel")).to_be_visible()

    # Tag filter
    page.click("button.tag:has-text('weekday')")
    expect(page.locator("#filter-toggle")).to_have_text("Filter (1)")
    expect(page.locator(".recipe-card")).to_have_count(1)
    page.screenshot(path=SHOTS / "laptop-1-list.png")
    page.click("button.tag:has-text('weekday')")

    page.keyboard.press("?")
    expect(page.locator("#shortcut-help")).to_be_visible()
    page.screenshot(path=SHOTS / "laptop-2-help.png")
    page.keyboard.press("Escape")

    # Owner filter and sorting (Kadi and Tõnis both own recipes now)
    expect(page.locator("#owner-filter button")).to_have_text(["Everyone", "Kadi", "Tõnis"])
    page.click("#owner-filter button:has-text('Kadi')")
    expect(page.locator(".recipe-card-title")).to_have_text(["Miso Aubergine with Soba"])
    page.click("#owner-filter button:has-text('Everyone')")
    page.select_option("#sort-select", "az")
    expect(page.locator(".recipe-card-title")).to_have_text(["Beef Shakshuka", "Miso Aubergine with Soba", "Spicy Miso Aubergine"])
    page.select_option("#sort-select", "rating")
    expect(page.locator(".recipe-card-title").first).to_have_text("Miso Aubergine with Soba")
    page.reload()  # choice is remembered on this device
    expect(page.locator("#sort-select")).to_have_value("rating")
    expect(page.locator("#filter-panel")).to_be_hidden()  # folded again after reload
    # "All recipes" is folded on every start: only the suggestion and search
    panel = page.locator("#all-panel")
    expect(panel).to_be_hidden()
    expect(page.locator("#suggestion")).to_be_visible()
    expect(page.locator("#add-recipe")).to_be_visible()
    # Searching unfolds it, and clearing the search folds it again
    page.keyboard.press("/")
    page.keyboard.type("shak")
    expect(page.locator(".recipe-card").first).to_be_visible()
    expect(page.locator("#all-toggle")).to_be_disabled()
    page.fill("#search", "")
    expect(panel).to_be_hidden()
    page.evaluate("document.activeElement.blur()")  # leave the text box
    # A shows and hides it; so does a click, for the phone
    page.keyboard.press("a")
    expect(panel).to_be_visible()
    expect(page.locator("#all-toggle")).to_have_attribute("aria-expanded", "true")
    page.screenshot(path=SHOTS / "laptop-5-unfolded.png")
    page.click("#all-toggle")
    expect(panel).to_be_hidden()
    page.screenshot(path=SHOTS / "laptop-6-folded.png")
    # Folded, the three panels fill the height down to the tab bar
    gap = page.evaluate("document.getElementById('tabbar').getBoundingClientRect().top - document.getElementById('all-toggle').getBoundingClientRect().bottom")
    assert 0 < gap < 32, gap
    assert page.evaluate("document.documentElement.scrollHeight <= window.innerHeight")
    # Suggestion initials: starts with this phone's owner (Tõnis)
    t_button = page.locator("#suggestion-owners button:has-text('T')")
    k_button = page.locator("#suggestion-owners button:has-text('K')")
    expect(page.locator("#suggestion-owners button")).to_have_text(["T", "K"])
    expect(t_button).to_have_attribute("aria-pressed", "true")
    expect(k_button).to_have_attribute("aria-pressed", "false")
    assert page.locator("#suggestion-link").inner_text() in ["Beef Shakshuka", "Spicy Miso Aubergine"]
    t_button.click()  # the last one stays on
    expect(t_button).to_have_attribute("aria-pressed", "true")
    # Both on: the dish on screen stays, it still counts
    shown = page.locator("#suggestion-link").inner_text()
    k_button.click()
    expect(k_button).to_have_attribute("aria-pressed", "true")
    expect(page.locator("#suggestion-link")).to_have_text(shown)
    page.screenshot(path=SHOTS / "laptop-7-initials.png")
    # Only K: Kadi has one recipe, so it shows at once and no "Another idea"
    page.keyboard.press("t")
    expect(t_button).to_have_attribute("aria-pressed", "false")
    expect(page.locator("#suggestion-link")).to_have_text("Miso Aubergine with Soba")
    expect(page.locator("#suggestion-next")).to_be_hidden()
    page.reload()  # the choice is remembered on this device
    expect(k_button).to_have_attribute("aria-pressed", "true")
    expect(t_button).to_have_attribute("aria-pressed", "false")
    page.keyboard.press("t")
    page.keyboard.press("k")
    expect(page.locator("#suggestion-next")).to_be_visible()
    # F from the folded page opens the list with its filters
    page.keyboard.press("f")
    expect(panel).to_be_visible()
    expect(page.locator("#filter-panel")).to_be_visible()
    page.screenshot(path=SHOTS / "laptop-4-sorted.png")
    page.select_option("#sort-select", "newest")

    # Plan shopping starts on the Shopping page; Esc comes back to it
    page.keyboard.press("l")
    expect(page.locator("#view-shopping")).to_be_visible()
    page.keyboard.press("p")
    expect(page.locator("#plan-bar")).to_be_visible()
    page.keyboard.press("Escape")
    expect(page.locator("#view-shopping")).to_be_visible()
    expect(page.locator("#plan-bar")).to_be_hidden()
    # Pick two recipes, make a list sorted by shop section
    page.click("#plan-start")
    expect(page.locator("#plan-bar")).to_be_visible()
    expect(page.locator("#suggestion")).to_be_hidden()  # the list has the stage
    page.click(".recipe-card:has-text('Miso Aubergine with Soba')")
    page.click(".recipe-card:has-text('Beef Shakshuka')")
    expect(page.locator("#plan-count")).to_have_text("2 recipes")
    expect(page.locator(".recipe-card.picked")).to_have_count(2)
    page.click("#plan-make")
    expect(page.locator("#view-shopping")).to_be_visible()
    expect(page.locator("#shop-recipes")).to_contain_text("Miso Aubergine with Soba (2)")
    sections = page.locator(".shop-section h2")
    expect(sections).to_have_text(["Produce", "Meat & fish", "Dairy & eggs", "Pantry"])
    expect(page.locator(".shop-name")).to_contain_text(["2 aubergines", "300 g beef mince", "4 eggs", "200 g soba noodles", "2 tbsp white miso"])
    expect(page.locator("#cart-count")).to_have_text("5")
    page.click(".shop-item:has-text('beef mince') .shop-check")
    expect(page.locator("#shop-progress-text")).to_have_text("1 of 5 ticked")
    expect(page.locator("#cart-count")).to_have_text("4")
    # Own item
    page.fill("#shop-add-input", "toilet paper")
    page.keyboard.press("Enter")
    expect(page.locator(".shop-section h2").last).to_have_text("Other")
    page.screenshot(path=SHOTS / "laptop-3-shopping.png", full_page=True)
    page.wait_for_timeout(2500)  # sync
    shared = [l for l in sheet.shopping.values() if not l["deleted"]]
    assert len(shared) == 1, sheet.shopping
    ticked = [i["name"] for i in shared[0]["items"].values() if i["checked"]]
    assert ticked == ["beef mince"], ticked

    # Making another list asks whether to add or start over
    # (and shortcuts work right after ticking a checkbox)
    page.click(".shop-item:has-text('aubergines') .shop-check")
    page.click(".shop-item:has-text('aubergines') .shop-check")
    page.keyboard.press("p")
    expect(page.locator("#plan-bar")).to_be_visible()
    page.click(".recipe-card:has-text('Spicy Miso Aubergine')")
    page.click("#plan-make")
    expect(page.locator("#make-list-dialog")).to_be_visible()
    page.click("#make-list-dialog button[value=add]")
    expect(page.locator("#view-shopping")).to_be_visible()
    expect(page.locator(".shop-name").filter(has_text="aubergines")).to_have_text("4 aubergines")
    page.click(".brand")

    # Delete syncs as well
    page.click(".recipe-card:has-text('Beef Shakshuka')")
    expect(page.locator("#view-recipe")).to_be_visible()
    expect(page.locator("#recipe-title")).to_have_text("Beef Shakshuka")
    page.keyboard.press("e")
    expect(page.locator("#delete-recipe")).to_be_visible()
    page.once("dialog", lambda d: d.accept())
    page.click("#delete-recipe")
    expect(page.locator(".recipe-card")).to_have_count(2)
    page.wait_for_timeout(2500)  # sync runs shortly after a change
    deleted = [r for r in sheet.recipes.values() if r["deleted"]]
    assert len(deleted) == 1, "deletion reached the Sheet"

    assert not errors, errors
    print("laptop: ok")


def test_installable_and_offline(p):
    """Manifest and icons load, service worker works, app opens offline."""
    errors = []
    ctx = p.chromium.launch().new_context(**p.devices["Pixel 7"])
    page = ctx.new_page()
    watch_errors(page, errors)
    page.goto(BASE)

    manifest = page.evaluate("fetch('manifest.webmanifest').then(r => r.json())")
    assert manifest["display"] == "standalone"
    for icon in manifest["icons"]:
        status = page.evaluate(f"fetch('{icon['src']}').then(r => r.status)")
        assert status == 200, f"missing icon {icon['src']}"

    page.evaluate("navigator.serviceWorker.ready")
    page.reload()  # now controlled by the service worker
    page.wait_for_function("navigator.serviceWorker.controller !== null")

    ctx.set_offline(True)
    page.reload()
    expect(page.locator("#add-recipe")).to_be_visible()
    page.click("#add-recipe")
    page.fill("#edit-text", "Offline omelette\n- 3 eggs")
    page.click("#edit-form button[type=submit]")
    page.fill("#name-input", "Kadi")
    page.click("#name-form button[type=submit]")
    expect(page.locator("#recipe-title")).to_have_text("Offline omelette")

    real_errors = [e for e in errors if "ERR_INTERNET_DISCONNECTED" not in e]
    assert not real_errors, real_errors
    print("installable + offline: ok")


def test_shopping_shared(p, sheet):
    """Kristiina's phone gets the shopping list Tõnis made, and her ticks go back."""
    errors = []
    ctx = p.chromium.launch().new_context(**p.devices["Pixel 7"])
    ctx.route(SHEET_URL, sheet.handle)
    ctx.add_init_script(
        f"localStorage.setItem('kitchen.settings.v1', JSON.stringify({{syncUrl: '{SHEET_URL}', myName: 'Kadi'}}))"
    )
    page = ctx.new_page()
    watch_errors(page, errors)
    page.goto(BASE)
    expect(page.locator("#sync-status")).to_have_attribute("data-state", "ok")
    page.click(".tab[data-tab=shopping]")
    expect(page.locator(".shop-item.checked .shop-name")).to_have_text(["300 g beef mince"])
    page.click(".shop-item:has-text('toilet paper') .shop-check")
    expect(page.locator("#shop-progress-text")).to_contain_text("2 of")
    page.screenshot(path=SHOTS / "phone-6-shopping.png", full_page=True)
    for width in (340, 360):
        page.set_viewport_size({"width": width, "height": 800})
        assert not page.evaluate("document.documentElement.scrollWidth > window.innerWidth"), width
    page.wait_for_timeout(2500)
    shared = [l for l in sheet.shopping.values() if not l["deleted"]][0]
    ticked = sorted(i["name"] for i in shared["items"].values() if i["checked"])
    assert ticked == ["beef mince", "toilet paper"], ticked
    assert not errors, errors
    print("shopping shared: ok")


def swipe(page, from_x, to_x, y=400, steps=6, step_ms=16, lift=True):
    """A finger swipe: touchstart, a few touchmoves, then touchend
    (like on a phone). lift=False keeps the finger down."""
    page.evaluate(
        """async ([fromX, toX, y, steps, stepMs, lift]) => {
            const target = document.elementFromPoint(fromX, y) || document.body;
            const touch = (x) => new Touch({ identifier: 1, target: target, clientX: x, clientY: y });
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            target.dispatchEvent(new TouchEvent("touchstart", { touches: [touch(fromX)], changedTouches: [touch(fromX)], bubbles: true }));
            for (let i = 1; i <= steps; i++) {
                await wait(stepMs);
                const x = fromX + ((toX - fromX) * i) / steps;
                target.dispatchEvent(new TouchEvent("touchmove", { touches: [touch(x)], changedTouches: [touch(x)], bubbles: true }));
            }
            if (lift) {
                target.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [touch(toX)], bubbles: true }));
            }
        }""",
        [from_x, to_x, y, steps, step_ms, lift],
    )


def test_pantry_tabs(p, sheet):
    """Kadi's phone: tabs and swiping, pantry linked to shopping."""
    errors = []
    ctx = p.chromium.launch().new_context(**p.devices["Pixel 7"])
    ctx.route(SHEET_URL, sheet.handle)
    ctx.add_init_script(
        f"if (!localStorage.getItem('kitchen.settings.v1')) localStorage.setItem('kitchen.settings.v1', JSON.stringify({{syncUrl: '{SHEET_URL}', myName: 'Kadi'}}))"
    )
    page = ctx.new_page()
    watch_errors(page, errors)
    page.goto(BASE)
    expect(page.locator("#sync-status")).to_have_attribute("data-state", "ok")
    expect(page.locator(".tab.active")).to_have_attribute("data-tab", "list")

    # Swipe left twice: Recipes → Shopping → Pantry; right goes back
    swipe(page, 330, 120)
    expect(page.locator("#view-shopping")).to_be_visible()
    swipe(page, 330, 120)
    expect(page.locator("#view-pantry")).to_be_visible()
    expect(page.locator(".tab.active")).to_have_attribute("data-tab", "pantry")
    # More sensitive: a 60 px swipe is enough
    swipe(page, 150, 210)
    expect(page.locator("#view-shopping")).to_be_visible()

    # The page follows the finger while it's down
    swipe(page, 300, 200, lift=False)
    moved = page.evaluate("document.getElementById('view-shopping').style.transform")
    assert moved == "translateX(-100px)", moved
    page.evaluate("""() => {
        const t = new Touch({ identifier: 1, target: document.body, clientX: 200, clientY: 400 });
        document.body.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [t], bubbles: true }));
    }""")
    expect(page.locator("#view-pantry")).to_be_visible()
    swipe(page, 120, 330)
    expect(page.locator("#view-shopping")).to_be_visible()

    # A short, slow drag springs back and stays on the page
    swipe(page, 200, 235, steps=6, step_ms=60)
    page.wait_for_timeout(400)
    expect(page.locator("#view-shopping")).to_be_visible()
    assert page.evaluate("document.getElementById('view-shopping').style.transform") == ""

    # From the screen edge (Android's Back gesture area): nothing happens
    swipe(page, 8, 300)
    expect(page.locator("#view-shopping")).to_be_visible()
    # A mostly vertical move is a scroll, not a swipe
    page.evaluate("""() => {
        const t = (x, y) => new Touch({ identifier: 1, target: document.body, clientX: x, clientY: y });
        const fire = (type, x, y) => document.body.dispatchEvent(new TouchEvent(type, { touches: type === "touchend" ? [] : [t(x, y)], changedTouches: [t(x, y)], bubbles: true }));
        fire("touchstart", 300, 600); fire("touchmove", 280, 500); fire("touchmove", 240, 300); fire("touchend", 240, 300);
    }""")
    expect(page.locator("#view-shopping")).to_be_visible()

    # Phone Back from a tab returns to Recipes
    page.go_back()
    expect(page.locator("#view-list")).to_be_visible()
    # First page: swiping right only stretches a little, then springs back
    swipe(page, 100, 300, lift=False)
    stretched = page.evaluate("document.getElementById('view-list').style.transform")
    assert stretched == "translateX(50px)", stretched
    page.evaluate("""() => {
        const t = new Touch({ identifier: 1, target: document.body, clientX: 300, clientY: 400 });
        document.body.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [t], bubbles: true }));
    }""")
    page.wait_for_timeout(400)
    expect(page.locator("#view-list")).to_be_visible()

    # ---------- Pantry ----------
    page.click(".tab[data-tab=pantry]")
    expect(page.locator("#pantry-empty")).to_be_visible()
    page.click("#pantry-staples")
    expect(page.locator(".pantry-item")).to_have_count(29)
    rice = page.locator(".pantry-item", has_text="Rice")
    rice.locator(".status-pill").click()
    expect(rice.locator(".status-pill")).to_have_text("Low")
    rice.locator(".status-pill").click()
    expect(rice.locator(".status-pill")).to_have_text("Out")
    expect(page.locator("#pantry-count")).to_have_text("1")
    page.click("#pantry-filter button[data-filter=low]")
    expect(page.locator(".pantry-name")).to_have_text(["Rice"])
    page.click("#pantry-filter button[data-filter=all]")
    # Own item: section guessed
    page.fill("#pantry-add-input", "Oat milk")
    page.keyboard.press("Enter")
    expect(page.locator(".shop-section", has_text="Fridge").locator(".pantry-name", has_text="Oat milk")).to_be_visible()
    # Rename / move / delete through the dialog (keyboard stays closed)
    page.click(".pantry-name:has-text('Oat milk')")
    expect(page.locator("#pantry-dialog")).to_be_visible()
    assert page.evaluate("document.activeElement.tagName") == "H2"
    page.once("dialog", lambda d: d.accept())
    page.click("#pantry-delete")
    expect(page.locator(".pantry-name:has-text('Oat milk')")).to_have_count(0)
    page.screenshot(path=SHOTS / "phone-7-pantry.png", full_page=True)

    # Low/out → shopping list; buying it restocks the pantry
    expect(page.locator("#pantry-restock")).to_contain_text("1 item is low or out")
    page.click("#pantry-to-shopping")
    expect(page.locator("#pantry-restock")).to_be_hidden()
    page.click(".tab[data-tab=shopping]")
    page.click(".shop-item:has-text('Rice') .shop-check")
    page.click(".tab[data-tab=pantry]")
    expect(page.locator(".pantry-item", has_text="Rice").locator(".status-pill")).to_have_text("Have")
    expect(page.locator("#pantry-count")).to_be_hidden()

    # A recipe shopping list moves what you have to "Check you have"
    page.fill("#pantry-add-input", "White miso")
    page.keyboard.press("Enter")
    page.click(".tab[data-tab=shopping]")
    page.click("#plan-start")
    page.click(".recipe-card:has-text('Miso Aubergine with Soba')")
    page.click("#plan-make")
    page.click("#make-list-dialog button[value=new]")
    miso = page.locator(".shop-item", has_text="white miso")
    expect(miso).to_contain_text("In your pantry")
    expect(page.locator(".shop-section", has_text="Check you have")).to_contain_text("white miso")
    expect(page.locator(".shop-section", has_text="Produce")).to_contain_text("aubergines")

    # Narrow phones: nothing sticks out sideways
    for width in (340, 360):
        page.set_viewport_size({"width": width, "height": 800})
        for tab in ("list", "shopping", "pantry", "projects"):
            page.click(f".tab[data-tab={tab}]")
            assert not page.evaluate("document.documentElement.scrollWidth > window.innerWidth"), (tab, width)

    page.wait_for_timeout(2500)  # sync
    assert "chores" not in sheet.stores  # chores no longer sync
    assert len([i for i in sheet.stores["pantry"].values() if not i.get("deleted")]) == 30

    # The laptop sees the same pantry
    laptop = p.chromium.launch().new_context(viewport={"width": 1366, "height": 768})
    laptop.route(SHEET_URL, sheet.handle)
    laptop.add_init_script(
        f"if (!localStorage.getItem('kitchen.settings.v1')) localStorage.setItem('kitchen.settings.v1', JSON.stringify({{syncUrl: '{SHEET_URL}', myName: 'Tõnis'}}))"
    )
    other = laptop.new_page()
    watch_errors(other, errors)
    other.goto(BASE + "#/projects")
    expect(other.locator("#view-projects")).to_be_visible()
    # Keyboard: → to Pantry... ← back to Shopping
    other.keyboard.press("ArrowLeft")
    expect(other.locator("#view-pantry")).to_be_visible()
    expect(other.locator(".pantry-item")).to_have_count(30)
    other.keyboard.press("n")
    assert other.evaluate("document.activeElement.id") == "pantry-add-input"
    other.screenshot(path=SHOTS / "laptop-5-pantry.png")

    assert not errors, errors
    print("pantry, tabs: ok")


def test_projects(p, sheet):
    """Projects on the Home tab: steps, things to buy, status; merged between devices."""
    errors = []

    def device(name, **options):
        ctx = p.chromium.launch().new_context(**options)
        ctx.route(SHEET_URL, sheet.handle)
        ctx.add_init_script(
            f"if (!localStorage.getItem('kitchen.settings.v1')) localStorage.setItem('kitchen.settings.v1', JSON.stringify({{syncUrl: '{SHEET_URL}', myName: '{name}'}}))"
        )
        page = ctx.new_page()
        watch_errors(page, errors)
        page.goto(BASE)
        expect(page.locator("#sync-status")).to_have_attribute("data-state", "ok")
        return page

    page = device("Kadi", **p.devices["Pixel 7"])
    # The last tab opens Projects, with no chores in sight
    page.click(".tab[data-tab=projects]")
    expect(page.locator("#view-projects")).to_be_visible()
    expect(page.locator(".tab.active .tab-label")).to_have_text("Projects")
    expect(page.locator("#projects-empty")).to_be_visible()

    # New project → opens straight away
    page.click("#project-add")
    assert page.evaluate("document.activeElement.tagName") == "H2", "keyboard must stay closed"
    page.fill("#project-title-input", "Hang hallway shelf")
    page.select_option("#project-effort", "evening")
    page.click("#project-form button[value=save]")
    expect(page.locator("#view-project")).to_be_visible()
    expect(page.locator("#project-title")).to_have_text("Hang hallway shelf")
    expect(page.locator("#project-meta")).to_contain_text("An evening · Anyone")
    expect(page.locator("#project-status .segment.active")).to_contain_text("Idea")

    # Steps
    for step in ("Buy wall plugs", "Drill holes", "Hang shelf"):
        page.fill("#project-step-input", step)
        page.keyboard.press("Enter")
    expect(page.locator("#project-steps .shop-name")).to_have_text(["Buy wall plugs", "Drill holes", "Hang shelf"])
    page.click("#project-steps .shop-item:has-text('Buy wall plugs') .shop-check")
    expect(page.locator("#project-progress")).to_have_text("1 of 3 done")
    # First ticked step: work has started
    expect(page.locator("#project-status .segment.active")).to_contain_text("Doing")

    # Things to buy → shopping list → ticking there marks them bought
    for item in ("8 wall plugs", "Spirit level"):
        page.fill("#project-material-input", item)
        page.keyboard.press("Enter")
    expect(page.locator("#project-to-shopping")).to_have_text("Add 2 to shopping list")
    page.click("#project-to-shopping")
    expect(page.locator("#project-to-shopping")).to_be_hidden()
    expect(page.locator("#project-materials")).to_contain_text("On the shopping list")
    # Notes save by themselves
    page.fill("#project-notes", "Shelf is 80 cm, concrete wall")
    page.locator("#project-title").click()
    page.screenshot(path=SHOTS / "phone-9-project.png", full_page=True)

    page.click(".tab[data-tab=shopping]")
    expect(page.locator("#view-shopping .shop-item", has_text="wall plugs")).to_contain_text("Hang hallway shelf")
    page.click("#view-shopping .shop-item:has-text('wall plugs') .shop-check")

    # Back to Home: it remembers Projects
    page.click(".tab[data-tab=projects]")
    expect(page.locator("#view-projects")).to_be_visible()
    card = page.locator(".project-card", has_text="Hang hallway shelf")
    expect(card).to_contain_text("1 of 3 steps · 1 to buy")
    bar = card.locator(".progress-fill").evaluate("el => el.getBoundingClientRect().width / el.parentElement.getBoundingClientRect().width")
    assert 0.3 < bar < 0.37, bar
    expect(page.locator(".project-group.group-doing h2")).to_have_text("In progress (1)")

    # A second project, as an idea
    page.click("#project-add")
    page.fill("#project-title-input", "Herb box for the balcony")
    page.select_option("#project-who", "Kadi")
    page.click("#project-form button[value=save]")
    page.click("#project-back")
    expect(page.locator(".project-group.group-idea")).to_contain_text("Herb box for the balcony")
    # Coming back must not replay an old slide animation
    assert page.evaluate("document.getElementById('view-projects').className") == "view", "stale slide class"
    page.screenshot(path=SHOTS / "phone-10-projects.png", full_page=True)
    for width in (340, 360):
        page.set_viewport_size({"width": width, "height": 800})
        assert not page.evaluate("document.documentElement.scrollWidth > window.innerWidth"), width
    page.set_viewport_size({"width": 412, "height": 915})
    page.wait_for_timeout(2500)  # sync

    # The laptop: sees the project, adds a step while the phone ticks one
    laptop = device("Tõnis", viewport={"width": 1366, "height": 768})
    laptop.goto(BASE + "#/projects")
    laptop.click(".project-card:has-text('Hang hallway shelf')")
    expect(laptop.locator("#project-notes")).to_have_value("Shelf is 80 cm, concrete wall")
    expect(laptop.locator("#project-materials .shop-item.checked")).to_contain_text("8 wall plugs")
    laptop.fill("#project-step-input", "Fill old holes")
    laptop.keyboard.press("Enter")
    page.click(".project-card:has-text('Hang hallway shelf')")
    page.click("#project-steps .shop-item:has-text('Drill holes') .shop-check")
    laptop.wait_for_timeout(2500)
    page.wait_for_timeout(2500)
    page.evaluate("window.dispatchEvent(new Event('online'))")  # sync now
    expect(page.locator("#project-steps .shop-name")).to_have_text(["Buy wall plugs", "Drill holes", "Hang shelf", "Fill old holes"])
    expect(page.locator("#project-progress")).to_have_text("2 of 4 done")
    laptop.evaluate("window.dispatchEvent(new Event('online'))")
    expect(laptop.locator("#project-progress")).to_have_text("2 of 4 done")

    # Keyboard on the laptop: E edits, Esc goes back; marking done
    laptop.locator("#project-title").click()  # leave the step box first
    laptop.keyboard.press("e")
    expect(laptop.locator("#project-dialog")).to_be_visible()
    laptop.keyboard.press("Escape")
    laptop.click("#project-status .segment[data-status=done]")
    expect(laptop.locator("#toast")).to_contain_text("Well done")
    laptop.keyboard.press("Escape")
    expect(laptop.locator("#view-projects")).to_be_visible()
    expect(laptop.locator(".project-group.group-done")).to_contain_text("Hang hallway shelf")
    laptop.screenshot(path=SHOTS / "laptop-6-projects.png")

    assert not errors, errors
    print("projects: ok")


def test_add_from_recipe(p):
    """The recipe page adds its ingredients, for the servings shown."""
    ctx = p.chromium.launch().new_context(**p.devices["Pixel 7"])
    ctx.add_init_script("if (!localStorage.getItem('kitchen.settings.v1')) localStorage.setItem('kitchen.settings.v1', JSON.stringify({myName: 'Kadi'}))")
    page = ctx.new_page()
    errors = []
    watch_errors(page, errors)
    page.goto(BASE)
    page.click("#add-recipe")
    page.fill("#edit-text", RECIPE)
    page.click("#edit-form button[type=submit]")
    expect(page.locator("#view-recipe")).to_be_visible()
    expect(page.locator("#servings-label")).to_have_text("2 servings")
    page.click("#servings-up")
    page.click("#servings-up")
    expect(page.locator("#servings-label")).to_have_text("4 servings")
    page.screenshot(path=SHOTS / "phone-recipe-add.png")
    page.click("#add-to-list")
    expect(page.locator("#toast")).to_contain_text("Added to the shopping list")
    expect(page.locator("#cart-count")).to_have_text("3")
    page.click("#toast .toast-action")
    expect(page.locator("#view-shopping")).to_be_visible()
    expect(page.locator(".shop-name").filter(has_text="aubergines")).to_have_text("4 aubergines")
    # A second time asks first, so a double tap doesn't double the list
    page.go_back()
    expect(page.locator("#view-recipe")).to_be_visible()
    page.click("#add-to-list")
    expect(page.locator("#toast")).to_contain_text("Already on the shopping list")
    page.click("#toast .toast-action")
    expect(page.locator("#toast")).to_contain_text("Added to the shopping list")
    page.click("#toast .toast-action")
    expect(page.locator(".shop-name").filter(has_text="aubergines")).to_have_text("8 aubergines")
    assert not errors, errors
    print("add from recipe: ok")


# A small web server for test_site_missing: serves the app until a file
# named OFF appears next to it, then answers 404 for everything, like
# GitHub Pages does while a site is unpublished.
SITE_SERVER = """
import functools, http.server, os, sys
root, port = sys.argv[1], int(sys.argv[2])
class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if os.path.exists(os.path.join(root, "OFF")):
            self.send_error(404, "Site not found")
        else:
            super().do_GET()
    def end_headers(self):
        # No browser caching, so the test sees what a phone sees once
        # GitHub's 10-minute cache has run out.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, *args):
        pass
http.server.ThreadingHTTPServer(("", port), functools.partial(Handler, directory=root)).serve_forever()
"""


def test_site_missing(p):
    """The website answers 404 (e.g. while GitHub Pages republishes):
    the installed app keeps working from its saved copy."""
    import tempfile
    root = Path.cwd()
    off = Path(tempfile.mkdtemp()) / "OFF"
    port = PORT + 1
    # Serve the repository folder; the OFF switch lives in a temp folder,
    # passed in by pointing the server's check at it via a symlinked root.
    site = off.parent / "site"
    site.symlink_to(root, target_is_directory=True)
    server = subprocess.Popen([sys.executable, "-c", SITE_SERVER.replace('os.path.join(root, "OFF")', repr(str(off))), str(site), str(port)])
    time.sleep(1)
    try:
        url = f"http://localhost:{port}/"
        ctx = p.chromium.launch().new_context(**p.devices["Pixel 7"])
        ctx.add_init_script("if (!localStorage.getItem('kitchen.settings.v1')) localStorage.setItem('kitchen.settings.v1', JSON.stringify({myName: 'Kadi'}))")
        page = ctx.new_page()
        page.goto(url)
        page.evaluate("navigator.serviceWorker.ready")
        page.reload()
        page.wait_for_function("navigator.serviceWorker.controller !== null")
        page.click("#add-recipe")
        page.fill("#edit-text", "Lentil soup\n- 200 g lentils")
        page.click("#edit-form button[type=submit]")
        expect(page.locator("#recipe-title")).to_have_text("Lentil soup")
        # Switch the site off: every file now answers 404
        off.write_text("off")
        page.goto(url)
        expect(page.locator("#all-toggle")).to_be_visible()
        expect(page.locator("#recipe-list")).to_contain_text("Lentil soup")
        print("site missing: ok")
    finally:
        server.terminate()


# Like GitHub Pages: browsers may keep every file for 10 minutes.
CACHING_SERVER = """
import functools, http.server, sys
root, port = sys.argv[1], int(sys.argv[2])
class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "max-age=600")
        super().end_headers()
    def log_message(self, *args):
        pass
http.server.ThreadingHTTPServer(("", port), functools.partial(Handler, directory=root)).serve_forever()
"""


def test_update_after_publish(p):
    """A new version is published while the browser may still keep the old
    files: the next start must load the new page AND the new code together."""
    import shutil
    import tempfile
    site = Path(tempfile.mkdtemp()) / "site"
    shutil.copytree(Path.cwd(), site, ignore=shutil.ignore_patterns(".git", "test-screenshots"))
    port = PORT + 2
    server = subprocess.Popen([sys.executable, "-c", CACHING_SERVER, str(site), str(port)])
    time.sleep(1)
    try:
        url = f"http://localhost:{port}/"
        ctx = p.chromium.launch().new_context(**p.devices["Pixel 7"])
        page = ctx.new_page()
        page.goto(url)
        page.evaluate("navigator.serviceWorker.ready")
        page.reload()
        page.wait_for_function("navigator.serviceWorker.controller !== null")
        expect(page.locator("#brand-version")).not_to_have_text("zz")
        # Publish: a changed version file with a newer date
        version = site / "js" / "version.js"
        version.write_text('export const APP_VERSION = "2099-01-01 zz";\n')
        future = time.time() + 60
        os.utime(version, (future, future))
        # Close and reopen the app, as on a phone
        page.close()
        page = ctx.new_page()
        page.goto(url)
        expect(page.locator("#brand-version")).to_have_text("zz")
        print("update after publish: ok")
    finally:
        server.terminate()


def main():
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(1)
    try:
        sheet = FakeSheet()
        with sync_playwright() as p:
            test_phone(p, sheet)
            test_laptop_second_device(p, sheet)
            test_shopping_shared(p, sheet)
            test_pantry_tabs(p, sheet)
            test_projects(p, sheet)
            test_installable_and_offline(p)
            test_add_from_recipe(p)
            test_site_missing(p)
            test_update_after_publish(p)
        print(f"all browser tests passed ({sheet.calls} sync calls)")
    finally:
        server.terminate()


if __name__ == "__main__":
    main()
