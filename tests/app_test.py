"""Browser tests (Playwright, Python).

Run from the repository folder:
    python tests/app_test.py [screenshot-folder]

Starts a local web server, tests on an Android phone profile (Pixel 7)
and a Windows laptop size with the keyboard, and fakes the Google Sheet
so sync can be tested without the internet. Made-up recipes only.
"""
import json
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
        f"localStorage.setItem('kitchen.settings.v1', JSON.stringify({{syncUrl: '{SHEET_URL}', myName: 'Tõnis'}}))"
    )
    page = ctx.new_page()
    watch_errors(page, errors)
    page.goto(BASE)

    # The recipe from the phone arrives through the Sheet
    expect(page.locator(".recipe-card")).to_have_count(1)
    expect(page.locator("#sync-status")).to_have_attribute("data-state", "ok")

    # Tõnis rates the same recipe with the keyboard; both ratings are kept
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
    page.locator("body").click()

    page.keyboard.press("n")
    expect(page.locator("#view-edit")).to_be_visible()
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

    # Tag filter
    page.click("button.tag:has-text('weekday')")
    expect(page.locator(".recipe-card")).to_have_count(1)
    page.screenshot(path=SHOTS / "laptop-1-list.png")
    page.click("button.tag:has-text('weekday')")

    page.keyboard.press("?")
    expect(page.locator("#shortcut-help")).to_be_visible()
    page.screenshot(path=SHOTS / "laptop-2-help.png")
    page.keyboard.press("Escape")

    # Plan shopping: pick two recipes, make a list sorted by shop section
    page.keyboard.press("p")
    expect(page.locator("#plan-bar")).to_be_visible()
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
    page.keyboard.press("Escape")
    expect(page.locator("#view-list")).to_be_visible()
    page.keyboard.press("p")
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
    page.click("#open-shopping")
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
            test_installable_and_offline(p)
        print(f"all browser tests passed ({sheet.calls} sync calls)")
    finally:
        server.terminate()


if __name__ == "__main__":
    main()
