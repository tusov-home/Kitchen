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
| Sesame | 1 tbsp |

## Method
1. Halve the aubergines and score them.
2. Roast at 220 °C for 20 minutes.
3. Brush with **miso glaze** and grill.
"""


class FakeSheet:
    """Acts like the Apps Script web app: merges and returns recipes."""

    def __init__(self):
        self.recipes = {}
        self.calls = 0

    def handle(self, route):
        self.calls += 1
        body = json.loads(route.request.post_data)
        for r in body.get("recipes", []):
            old = self.recipes.get(r["id"])
            if not old or r["updatedAt"] > old["updatedAt"]:
                self.recipes[r["id"]] = r
        route.fulfill(
            status=200,
            content_type="application/json",
            headers={"Access-Control-Allow-Origin": "*"},
            body=json.dumps({"ok": True, "recipes": list(self.recipes.values())}),
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
    page.click("button[type=submit]")

    expect(page.locator("#recipe-title")).to_have_text("Miso Aubergine with Soba")
    assert page.locator("#recipe-body h1").count() == 0, "title must not repeat"
    expect(page.locator("#recipe-body ol li")).to_have_count(3)
    expect(page.locator("#recipe-body table")).to_be_visible()
    page.click("#cooked-today")
    expect(page.locator("#recipe-notes")).to_contain_text("Cooked")
    page.screenshot(path=SHOTS / "phone-3-recipe.png", full_page=True)

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
        f"localStorage.setItem('kitchen.settings.v1', JSON.stringify({{syncUrl: '{SHEET_URL}'}}))"
    )
    page = ctx.new_page()
    watch_errors(page, errors)
    page.goto(BASE)

    # The recipe from the phone arrives through the Sheet
    expect(page.locator(".recipe-card")).to_have_count(1)
    expect(page.locator("#sync-status")).to_have_attribute("data-state", "ok")

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
    expect(page.locator(".recipe-card")).to_have_count(2)

    # Tag filter
    page.click("button.tag:has-text('weekday')")
    expect(page.locator(".recipe-card")).to_have_count(1)
    page.screenshot(path=SHOTS / "laptop-1-list.png")
    page.click("button.tag:has-text('weekday')")

    page.keyboard.press("?")
    expect(page.locator("#shortcut-help")).to_be_visible()
    page.screenshot(path=SHOTS / "laptop-2-help.png")
    page.keyboard.press("Escape")

    # Delete syncs as well
    page.click(".recipe-card:has-text('Beef Shakshuka')")
    expect(page.locator("#view-recipe")).to_be_visible()
    expect(page.locator("#recipe-title")).to_have_text("Beef Shakshuka")
    page.keyboard.press("e")
    expect(page.locator("#delete-recipe")).to_be_visible()
    page.once("dialog", lambda d: d.accept())
    page.click("#delete-recipe")
    expect(page.locator(".recipe-card")).to_have_count(1)
    page.wait_for_timeout(2500)  # sync runs shortly after a change
    deleted = [r for r in sheet.recipes.values() if r["deleted"]]
    assert len(deleted) == 1, "deletion reached the Sheet"

    assert not errors, errors
    print("laptop: ok")


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
        print(f"all browser tests passed ({sheet.calls} sync calls)")
    finally:
        server.terminate()


if __name__ == "__main__":
    main()
