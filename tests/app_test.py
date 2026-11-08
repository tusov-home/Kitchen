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
import re
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

    expect(page.locator("#welcome")).to_be_visible()
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
    # Tags fold behind one line
    expect(page.locator("#recipe-tags-label")).to_have_text("2 tags")
    expect(page.locator("#recipe-tags")).to_be_hidden()
    page.click("#recipe-tags-label")
    expect(page.locator("#recipe-tags")).to_contain_text("vegetarian")
    # The title's second line runs under the edit and copy buttons
    tools = page.evaluate("document.querySelector('.recipe-tools').getBoundingClientRect().bottom")
    line = page.evaluate("parseFloat(getComputedStyle(document.getElementById('recipe-title')).lineHeight)")
    top = page.evaluate("document.getElementById('recipe-title').getBoundingClientRect().top")
    assert tools <= top + line + 1, (tools, top, line)

    # The cooking plan: Add to plan, shop for it, then review it
    expect(page.locator("#plan-toggle")).to_have_count(0)  # no button: swipe or P
    page.keyboard.press("p")
    expect(page.locator("#toast")).to_contain_text("Added to the cooking plan")
    close_recipe(page)
    expect(page.locator("#plan-count")).to_have_text("1")
    page.click("#plan-row")
    expect(page.locator("#view-plan")).to_be_visible()
    # The plan is a sheet on top of the recipes page, like a recipe
    expect(page.locator("#view-list")).to_be_visible()
    expect(page.locator("#recipe-backdrop")).to_be_visible()
    page.wait_for_timeout(400)
    swipe_down(page, 120, 400)  # pulling it down from the top closes it
    expect(page.locator("#view-plan")).to_be_hidden()
    expect(page.locator("#view-list")).to_be_visible()
    page.click("#plan-row")
    expect(page.locator("#view-plan")).to_be_visible()
    expect(page.locator("#plan-shop .plan-title")).to_have_text(["Miso Aubergine with Soba"])
    page.click("#plan-shop .shop-remove")
    page.click("#ask-dialog button[value=cancel]")
    expect(page.locator("#plan-shop .plan-title")).to_have_count(1)
    page.click("#plan-shop .step-button[aria-label='More servings']")
    page.click("#plan-shop .step-button[aria-label='More servings']")
    expect(page.locator("#plan-shop .step-value")).to_have_text("4")
    # The recipe shows the planned amounts: ingredients double, the method doesn't
    page.click("#plan-shop .plan-title")
    expect(page.locator("#view-recipe")).to_be_visible()
    expect(page.locator("#recipe-scale")).to_have_text("Amounts for 4 servings, as in the cooking plan")
    body = page.locator("#recipe-body")
    expect(body).to_contain_text("4 aubergines")
    expect(body).to_contain_text("400 g soba noodles")
    expect(body).to_contain_text("2 tbsp sesame")
    expect(body).to_contain_text("Roast at 220 °C for 20 minutes")
    # The method shows each ingredient's total in brackets, at 4 servings too
    expect(body.locator("ol li").first).to_have_text("Halve the aubergines (4) and score them.")
    expect(body.locator("ol .amount-hint").first).to_have_text("(4)")
    page.screenshot(path=SHOTS / "phone-3-recipe.png")
    page.go_back()
    expect(page.locator("#view-plan")).to_be_visible()
    page.screenshot(path=SHOTS / "phone-plan.png")
    page.click("#plan-shop-all")
    expect(page.locator("#cart-count")).to_have_text("3")
    expect(page.locator("#plan-shop-section")).to_be_hidden()
    expect(page.locator("#plan-finish")).to_be_visible()
    # Shopped for: the card on the recipes page shows the planned meal
    close_recipe(page)
    expect(page.locator("#suggestion-label")).to_have_text("From the cooking plan: 1 of 1")
    expect(page.locator("#suggestion-link")).to_have_text("Miso Aubergine with Soba")
    expect(page.locator("#suggestion-reason")).to_have_text("4 servings")
    page.screenshot(path=SHOTS / "phone-plan-card.png")
    page.click("#plan-row")
    expect(page.locator("#view-plan")).to_be_visible()
    # Review: cooked goes into the notes, stars from 1 to 5
    page.click("#plan-review .plan-cooked input")
    page.locator("#plan-review .star").nth(3).click()
    expect(page.locator("#plan-review .star.filled")).to_have_count(4)
    expect(page.locator("#plan-hide-cooked")).to_have_text("Hide cooked")
    page.click("#plan-hide-cooked")
    expect(page.locator("#plan-review .plan-item")).to_have_count(0)
    page.click("#plan-hide-cooked")
    expect(page.locator("#plan-review .plan-item")).to_have_count(1)
    page.fill("#plan-review .plan-note input", "More chilli")
    page.keyboard.press("Enter")
    page.screenshot(path=SHOTS / "phone-plan-review.png")
    page.click("#plan-finish")
    page.click("#ask-dialog button[value=ok]")
    expect(page.locator("#plan-empty")).to_be_visible()
    close_recipe(page)
    expect(page.locator("#suggestion-label")).to_contain_text("Suggestion for")  # daily ideas again
    # Clear the shopping list again, for the laptop's turn
    page.goto(BASE + "#/shopping")
    page.click("#shop-delete")
    page.click("#ask-dialog button[value=ok]")
    page.goto(BASE + "#/")
    expect(page.locator("#plan-head")).to_be_hidden()
    page.click("#meals-toggle")
    page.click(".recipe-card")
    expect(page.locator("#recipe-notes")).to_contain_text("Cooked")
    expect(page.locator("#recipe-notes")).to_contain_text("More chilli")
    # Out of the plan, it's as written again
    expect(page.locator("#recipe-scale")).to_be_hidden()
    expect(page.locator("#recipe-body")).to_contain_text("2 aubergines")

    # Phone Back button goes to the meals it was opened from, then home
    page.go_back()
    expect(page.locator("#view-browse")).to_be_visible()
    expect(page.locator("#view-recipe")).to_be_hidden()
    expect(page.locator(".recipe-card")).to_have_count(1)
    page.go_back()
    expect(page.locator("#view-browse")).to_be_hidden()
    expect(page.locator("#view-list")).to_be_visible()

    # Set up sync: Settings is the last page, in the top bar
    page.click(".tab[data-tab=settings]")
    expect(page.locator("#view-settings")).to_be_visible()
    page.fill("#sync-url", SHEET_URL)
    page.click("#sync-save")
    expect(page.locator("#settings-sync-status")).to_contain_text("Synced")
    expect(page.locator("#brand-mark")).to_have_attribute("data-state", "ok")
    page.screenshot(path=SHOTS / "phone-4-settings.png")
    page.keyboard.press("Escape")
    expect(page.locator("#view-list")).to_be_visible()
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
    expect(page.locator("#brand-mark")).to_have_attribute("data-state", "ok")

    # Tõnis rates the same recipe with the keyboard; both ratings are kept
    page.click("#meals-toggle")
    page.click(".recipe-card")
    expect(page.locator("#view-recipe")).to_be_visible()
    # Tõnis plans it with the keyboard and finds Kadi's stars kept with his
    page.keyboard.press("p")
    expect(page.locator("#toast")).to_contain_text("Added to the cooking plan")
    # Taking it out asks first: "Cancel" keeps it, "OK" takes it out
    page.keyboard.press("p")
    expect(page.locator("#ask-dialog")).to_be_visible()
    page.click("#ask-dialog button[value=cancel]")
    expect(page.locator("#ask-dialog")).to_be_hidden()
    page.keyboard.press("p")
    expect(page.locator("#ask-dialog")).to_be_visible()  # still in, so it asks again
    page.click("#ask-dialog button[value=ok]")
    expect(page.locator("#toast")).to_contain_text("Taken out of the plan")
    page.keyboard.press("Escape")
    expect(page.locator("#view-recipe")).to_be_hidden()  # back on the meals
    expect(page.locator(".card-stars")).to_have_text("★ 4")
    # Tõnis rates it too, in the plan's review: both ratings are kept
    page.locator(".recipe-card").first.click()
    expect(page.locator("#view-recipe")).to_be_visible()
    page.keyboard.press("p")
    expect(page.locator("#toast")).to_contain_text("Added to the cooking plan")
    # The plan is shared: it reaches the Sheet, with the phone's finished meal too
    page.wait_for_timeout(2500)
    shared_plan = list(sheet.stores["plan"].values())[0]["meals"]
    assert [m for m in shared_plan.values() if not m["removed"]], shared_plan
    page.keyboard.press("Escape")
    expect(page.locator("#view-recipe")).to_be_hidden()
    page.keyboard.press("p")
    expect(page.locator("#view-plan")).to_be_visible()
    page.click("#plan-shop-all")
    page.locator("#plan-review .star").nth(4).click()
    expect(page.locator("#plan-review .star.filled")).to_have_count(5)
    page.click("#plan-finish")
    page.click("#ask-dialog button[value=ok]")
    page.goto(BASE + "#/shopping")
    page.click("#shop-delete")
    page.click("#ask-dialog button[value=ok]")
    page.goto(BASE + "#/")
    expect(page.locator(".card-stars")).to_have_text("★ 4.5")
    page.wait_for_timeout(2500)  # sync runs shortly after a change
    synced = list(sheet.recipes.values())[0]["ratings"]
    assert set(synced) == {"Kadi", "Tõnis"}, synced

    # Kadi's recipe is view-only for Tõnis: no Edit, but "Make my copy"
    show_meals(page)
    page.click(".recipe-card")
    expect(page.locator("#view-recipe")).to_be_visible()
    expect(page.locator("#recipe-owner")).to_have_text("Added by Kadi")
    expect(page.locator("#edit-link")).to_be_hidden()
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
    expect(page.locator("#recipe-body")).not_to_contain_text("Miso Aubergine with Soba")
    page.screenshot(path=SHOTS / "laptop-0-copy.png")
    go_home(page)
    expect(page.locator(".recipe-card")).to_have_count(2)
    expect(page.locator(".card-owner")).to_have_count(2)

    # Keyboard: / search, N new, Ctrl+S save, Esc back, E edit, ? help
    page.keyboard.press("/")
    page.keyboard.type("zzz")
    expect(page.locator("#view-browse")).to_be_visible()  # results open in a sheet
    expect(page.locator("#no-results")).to_be_visible()
    page.fill("#search", "")
    expect(page.locator("#view-browse")).to_be_hidden()  # empty search: closed again
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
    expect(page.locator("#view-recipe")).to_be_hidden()
    expect(page.locator(".recipe-card")).to_have_count(3)

    # Today's suggestion is the first thing on the page
    suggestion = page.locator("#suggestion")
    expect(suggestion).to_be_visible()
    expect(page.locator("#suggestion-label")).to_contain_text("Suggestion for")
    first = page.locator("#suggestion-link").inner_text()
    page.click("#suggestion-next")
    expect(page.locator("#suggestion-link")).not_to_have_text(first)
    # Search: results open in a sheet on top, while typing goes on below
    page.keyboard.press("/")
    page.keyboard.type("shak")
    expect(page.locator("#view-browse")).to_be_visible()
    expect(page.locator("#browse-title")).to_have_text("Search")
    expect(page.locator("#search")).to_be_focused()
    expect(page.locator(".recipe-card")).to_have_count(1)
    # A result opens on top of the results; closing it lands back on them
    page.click(".recipe-card")
    expect(page.locator("#view-recipe")).to_be_visible()
    expect(page.locator("#view-browse")).to_be_visible()  # still underneath
    page.keyboard.press("Escape")
    expect(page.locator("#view-recipe")).to_be_hidden()
    expect(page.locator("#view-browse")).to_be_visible()
    expect(page.locator("#search")).to_have_value("shak")
    # Esc closes the results, and the search starts empty next time
    page.keyboard.press("Escape")
    expect(page.locator("#view-browse")).to_be_hidden()
    expect(page.locator("#search")).to_have_value("")
    expect(suggestion).to_be_visible()
    # Open the suggested recipe
    picked = page.locator("#suggestion-link").inner_text()
    page.click("#suggestion")
    expect(page.locator("#view-recipe")).to_be_visible()  # wait for the page itself
    expect(page.locator("#recipe-title")).to_have_text(picked)
    page.keyboard.press("Escape")
    expect(page.locator("#view-list")).to_be_visible()
    expect(page.locator("#view-recipe")).to_be_hidden()

    # Filters are folded away until asked for (F or the Filter button);
    # F on the recipes page opens the meals with their filters
    expect(page.locator("#filter-panel")).to_be_hidden()
    page.keyboard.press("f")
    expect(page.locator("#view-browse")).to_be_visible()
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
    page.reload()  # choice is remembered on this device (the sheet stays open)
    expect(page.locator("#sort-select")).to_have_value("rating")
    expect(page.locator("#filter-panel")).to_be_hidden()  # folded again after reload
    page.keyboard.press("Escape")
    panel = page.locator("#view-browse")
    expect(panel).to_be_hidden()
    expect(page.locator("#suggestion")).to_be_visible()
    expect(page.locator("#add-recipe")).to_be_visible()
    # A opens the meals and closes them again; S switches to sauces
    page.keyboard.press("a")
    expect(panel).to_be_visible()
    expect(page.locator("#browse-title")).to_have_text("Meals")
    page.screenshot(path=SHOTS / "laptop-5-unfolded.png")
    page.keyboard.press("s")
    expect(page.locator("#browse-title")).to_have_text("Sauces & condiments")
    page.keyboard.press("s")
    expect(panel).to_be_hidden()
    page.click("#meals-toggle")
    expect(panel).to_be_visible()
    close_recipe(page)  # a tap above the sheet closes it
    page.screenshot(path=SHOTS / "laptop-6-folded.png")
    # The page fills the height down to the search bar at the bottom
    gap = page.evaluate("document.getElementById('list-dock').getBoundingClientRect().top - document.getElementById('sauces-toggle').getBoundingClientRect().bottom")
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
    expect(page.locator("#suggestion-next")).to_be_disabled()
    page.reload()  # the choice is remembered on this device
    expect(k_button).to_have_attribute("aria-pressed", "true")
    expect(t_button).to_have_attribute("aria-pressed", "false")
    page.keyboard.press("t")
    page.keyboard.press("k")
    expect(page.locator("#suggestion-next")).to_be_enabled()
    # F from the recipes page opens the list with its filters
    page.keyboard.press("f")
    expect(panel).to_be_visible()
    expect(page.locator("#filter-panel")).to_be_visible()
    page.screenshot(path=SHOTS / "laptop-4-sorted.png")
    page.select_option("#sort-select", "newest")
    page.keyboard.press("Escape")

    # Add two recipes: a list sorted by shop section
    expect(page.locator("#plan-start")).to_have_count(0)
    add_to_list(page, "Miso Aubergine with Soba")
    add_to_list(page, "Beef Shakshuka")
    open_tab(page, "shopping")
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

    # Shortcuts work right after ticking a checkbox
    page.click(".shop-item:has-text('aubergines') .shop-check")
    page.keyboard.press("ArrowRight")
    expect(page.locator("#view-pantry")).to_be_visible()
    # Ticked things fold away, and can be unticked from there
    page.keyboard.press("ArrowLeft")
    expect(page.locator("#view-shopping")).to_be_visible()
    expect(page.locator("#shop-ticked-label")).to_have_text("Ticked (2)")
    expect(page.locator("#shop-sections .shop-item:has-text('aubergines')")).to_have_count(0)
    expect(page.locator("#shop-ticked .shop-item:has-text('aubergines')")).to_be_hidden()
    page.click("#shop-ticked-label")
    page.click("#shop-ticked .shop-item:has-text('aubergines') .shop-check")
    expect(page.locator("#shop-sections .shop-item:has-text('aubergines')")).to_have_count(1)
    expect(page.locator("#shop-ticked-label")).to_have_text("Ticked (1)")
    # Another recipe joins the same list
    add_to_list(page, "Spicy Miso Aubergine")
    open_tab(page, "shopping")
    expect(page.locator(".shop-name").filter(has_text="aubergines")).to_have_text("4 aubergines")
    go_home(page)

    # Delete syncs as well
    show_meals(page)
    page.click(".recipe-card:has-text('Beef Shakshuka')")
    expect(page.locator("#view-recipe")).to_be_visible()
    expect(page.locator("#recipe-title")).to_have_text("Beef Shakshuka")
    page.keyboard.press("e")
    expect(page.locator("#delete-recipe")).to_be_visible()
    page.click("#delete-recipe")
    page.click("#ask-dialog button[value=ok]")
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
    expect(page.locator("#brand-mark")).to_have_attribute("data-state", "ok")
    open_tab(page, "shopping")
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


SHEETS = "#view-recipe:not([hidden]), #view-plan:not([hidden]), #view-browse:not([hidden]), #view-project:not([hidden])"


def close_recipe(page):
    """Tap above the sheets until the recipes page shows: a recipe may lie
    on the list or plan it was opened from."""
    for _ in range(3):
        if page.locator(SHEETS).count() == 0:
            break
        page.wait_for_timeout(350)  # an opening sheet may still be moving
        before = page.evaluate("location.hash")
        page.locator("#recipe-backdrop").click(position={"x": 5, "y": 3})
        page.wait_for_function("h => location.hash !== h", arg=before)
    expect(page.locator(SHEETS)).to_have_count(0)


def show_meals(page):
    """On the recipes page, open the meals sheet (the cards live there)."""
    if page.locator("#view-browse").is_hidden():
        page.click("#meals-toggle")
        expect(page.locator("#view-browse")).to_be_visible()
        page.wait_for_timeout(350)  # let it finish rising


def open_tab(page, name):
    """Tap a page icon, closing a sheet first: it covers the top bar."""
    page.wait_for_timeout(250)  # a screen change may still be under way
    if page.locator(SHEETS).count():
        close_recipe(page)
    page.locator(f".tab[data-tab={name}]").click()


def go_home(page):
    page.wait_for_timeout(250)  # a screen change may still be under way
    if page.locator(SHEETS).count():
        close_recipe(page)  # that's home already
    else:
        page.locator(".brand").click()
    expect(page.locator("#view-list")).to_be_visible()
    expect(page.locator("#view-recipe")).to_be_hidden()


def add_to_list(page, name):
    """Swipe a recipe into the plan, then put the plan on the shopping list."""
    page.goto(BASE + "#/")
    expect(page.locator("#view-list")).to_be_visible()
    expect(page.locator("#view-recipe")).to_be_hidden()
    page.click("#meals-toggle")
    expect(page.locator("#view-browse")).to_be_visible()
    page.locator(".recipe-card", has_text=name).first.click()
    expect(page.locator("#view-recipe")).to_be_visible()
    expect(page.locator("#recipe-title")).to_have_text(name)
    planned = page.evaluate("""() => {
        const plan = JSON.parse(localStorage.getItem('kitchen.plan.v1') || '[]')[0];
        const id = decodeURIComponent(location.hash.split('/').pop());
        const meal = plan && plan.meals && plan.meals[id];
        return Boolean(meal && !meal.removed);
    }""")
    if planned:  # in the plan from an earlier round? then out first
        page.keyboard.press("p")
        expect(page.locator("#ask-dialog")).to_be_visible()
        page.click("#ask-dialog button[value=ok]")
        expect(page.locator("#toast")).to_contain_text("Taken out of the plan")
    page.keyboard.press("ArrowLeft")
    expect(page.locator("#added-dialog")).to_be_visible()
    page.click("#added-dialog button[value=ok]")
    expect(page.locator("#added-dialog")).to_be_hidden()
    page.wait_for_timeout(400)  # the next recipe arrives
    page.goto(BASE + "#/plan")
    expect(page.locator("#view-plan")).to_be_visible()
    page.click("#plan-shop-all")
    expect(page.locator("#plan-shop-section")).to_be_hidden()


def swipe_down(page, from_y, to_y, x=200, lift=True):
    """A finger pulling the page down."""
    page.evaluate(
        """async ([x, fromY, toY, lift]) => {
            const target = document.elementFromPoint(x, fromY) || document.body;
            const touch = (y) => new Touch({ identifier: 1, target: target, clientX: x, clientY: y });
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            target.dispatchEvent(new TouchEvent("touchstart", { touches: [touch(fromY)], changedTouches: [touch(fromY)], bubbles: true }));
            for (let i = 1; i <= 6; i++) {
                await wait(16);
                const y = fromY + ((toY - fromY) * i) / 6;
                target.dispatchEvent(new TouchEvent("touchmove", { touches: [touch(y)], changedTouches: [touch(y)], bubbles: true }));
            }
            if (lift) {
                target.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [touch(toY)], bubbles: true }));
            }
        }""",
        [x, from_y, to_y, lift],
    )


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
    expect(page.locator("#brand-mark")).to_have_attribute("data-state", "ok")
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
    page.wait_for_timeout(50)  # moves on the next screen refresh
    moved = page.evaluate("document.getElementById('view-shopping').style.transform")
    assert moved == "translate3d(-100px, 0px, 0px)", moved
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
    expect(page.locator("#view-recipe")).to_be_hidden()
    # First page: swiping right only stretches a little, then springs back
    swipe(page, 100, 300, lift=False)
    page.wait_for_timeout(50)
    stretched = page.evaluate("document.getElementById('view-list').style.transform")
    assert stretched == "translate3d(50px, 0px, 0px)", stretched
    page.evaluate("""() => {
        const t = new Touch({ identifier: 1, target: document.body, clientX: 300, clientY: 400 });
        document.body.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [t], bubbles: true }));
    }""")
    page.wait_for_timeout(400)
    expect(page.locator("#view-list")).to_be_visible()
    expect(page.locator("#view-recipe")).to_be_hidden()

    # ---------- Pantry ----------
    open_tab(page, "pantry")
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
    page.click("#pantry-delete")
    page.click("#ask-dialog button[value=ok]")
    expect(page.locator(".pantry-name:has-text('Oat milk')")).to_have_count(0)
    page.screenshot(path=SHOTS / "phone-7-pantry.png", full_page=True)

    # Low/out → shopping list; buying it restocks the pantry
    expect(page.locator("#pantry-to-shopping")).to_have_text("Restock: add 1 to shopping")
    page.click("#pantry-to-shopping")
    expect(page.locator("#pantry-restock")).to_be_hidden()
    open_tab(page, "shopping")
    page.click(".shop-item:has-text('Rice') .shop-check")
    open_tab(page, "pantry")
    expect(page.locator(".pantry-item", has_text="Rice").locator(".status-pill")).to_have_text("Have")
    expect(page.locator("#pantry-count")).to_be_hidden()

    # The search on the recipes page finds pantry items too: one tap marks low
    open_tab(page, "list")
    page.click("#search")
    page.keyboard.type("ric")
    expect(page.locator("#view-browse")).to_be_visible()
    hits = page.locator("#pantry-results .pantry-item")
    expect(hits.first).to_contain_text("Rice")
    page.screenshot(path=SHOTS / "phone-search-pantry.png")
    hits.filter(has_text="Rice").first.locator(".status-pill").click()
    expect(hits.filter(has_text="Rice").first.locator(".status-pill")).to_have_text("Low")
    expect(page.locator("#pantry-count")).to_have_text("1")
    expect(page.locator("#view-browse")).to_be_visible()  # still in the results
    page.fill("#search", "")
    expect(page.locator("#view-browse")).to_be_hidden()
    open_tab(page, "pantry")
    rice_pill = page.locator(".pantry-item", has_text="Rice").first.locator(".status-pill")
    expect(rice_pill).to_have_text("Low")
    rice_pill.click()
    rice_pill.click()  # Out → Have again
    expect(rice_pill).to_have_text("Have")

    # A recipe shopping list moves what you have to "Check you have"
    page.fill("#pantry-add-input", "White miso")
    page.keyboard.press("Enter")
    open_tab(page, "shopping")
    page.click("#shop-delete")
    page.click("#ask-dialog button[value=ok]")
    add_to_list(page, "Miso Aubergine with Soba")
    open_tab(page, "shopping")
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
        expect(page.locator("#brand-mark")).to_have_attribute("data-state", "ok")
        return page

    page = device("Kadi", **p.devices["Pixel 7"])
    # The last tab opens Projects, with no chores in sight
    open_tab(page, "projects")
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

    open_tab(page, "shopping")
    expect(page.locator("#view-shopping .shop-item", has_text="wall plugs")).to_contain_text("Hang hallway shelf")
    page.click("#view-shopping .shop-item:has-text('wall plugs') .shop-check")

    # Back to Home: it remembers Projects
    open_tab(page, "projects")
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
    expect(page.locator("#view-project")).to_be_visible()
    expect(page.locator("#view-projects")).to_be_visible()  # a sheet on top of the list
    close_recipe(page)
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
    # Settings is the page after Projects: → (or a swipe) gets there
    laptop.goto(BASE + "#/projects")
    expect(laptop.locator("#view-projects")).to_be_visible()
    laptop.keyboard.press("ArrowRight")
    expect(laptop.locator("#view-settings")).to_be_visible()
    expect(laptop.locator(".tab[data-tab=settings]")).to_have_attribute("aria-current", "page")
    laptop.keyboard.press("ArrowLeft")
    expect(laptop.locator("#view-projects")).to_be_visible()

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
    page.screenshot(path=SHOTS / "phone-recipe-add.png")
    # L goes to the shopping list and closes the recipe: swiping back leads to Recipes
    page.keyboard.press("l")
    expect(page.locator("#view-shopping")).to_be_visible()
    expect(page.locator("#cart-count")).to_be_hidden()
    page.wait_for_timeout(300)
    swipe(page, 60, 300)
    expect(page.locator("#view-list")).to_be_visible()
    expect(page.locator("#view-recipe")).to_be_hidden()
    page.locator(".recipe-card").first.click() if page.locator(".recipe-card").first.is_visible() else page.click("#suggestion")
    expect(page.locator("#view-recipe")).to_be_visible()
    # Swiping right puts it in the plan; servings are set there; the plan shops for it
    page.keyboard.press("ArrowLeft")
    expect(page.locator("#added-text")).to_contain_text("Set the servings in the plan")
    page.click("#added-dialog button[value=ok]")
    expect(page.locator("#cart-count")).to_be_hidden()
    page.wait_for_timeout(400)  # it moves on to the next recipe first
    page.goto(BASE + "#/plan")
    expect(page.locator("#view-plan")).to_be_visible()
    expect(page.locator("#plan-shop .step-value")).to_have_text("2")
    page.click("#plan-shop .step-button[aria-label='More servings']")
    page.click("#plan-shop .step-button[aria-label='More servings']")
    expect(page.locator("#plan-shop .step-value")).to_have_text("4")
    page.click("#plan-shop-all")
    expect(page.locator("#cart-count")).to_have_text("3")
    open_tab(page, "shopping")
    expect(page.locator(".shop-name").filter(has_text="aubergines")).to_have_text("4 aubergines")
    expect(page.locator("#shop-recipes")).to_contain_text("Miso Aubergine with Soba (4)")
    assert not errors, errors
    print("add from recipe: ok")


def test_meals_and_sauces(p):
    """Two kinds of recipe, each with its own row."""
    ctx = p.chromium.launch().new_context(**p.devices["Pixel 7"])
    ctx.add_init_script("if (!localStorage.getItem('kitchen.settings.v1')) localStorage.setItem('kitchen.settings.v1', JSON.stringify({myName: 'Kadi'}))")
    page = ctx.new_page()
    errors = []
    watch_errors(page, errors)
    page.goto(BASE)
    # No recipes yet: no rows, just how to add the first one
    expect(page.locator("#welcome")).to_be_visible()
    expect(page.locator("#meals-toggle")).to_be_hidden()
    page.click("#add-recipe")
    expect(page.locator("#edit-kind .segment.active")).to_have_text("Meal")
    page.fill("#edit-text", RECIPE)
    page.click("#edit-form button[type=submit]")
    expect(page.locator("#view-recipe")).to_be_visible()
    page.go_back()
    expect(page.locator("#recipe-count")).to_have_text("1")
    expect(page.locator("#sauce-count")).to_have_text("0")
    # + from the open sauces sheet starts a sauce
    page.click("#sauces-toggle")
    expect(page.locator("#view-browse")).to_be_visible()
    expect(page.locator("#no-results")).to_contain_text("No sauces or condiments yet")
    page.screenshot(path=SHOTS / "phone-sauces-empty.png")
    page.click("#add-recipe")
    expect(page.locator("#edit-kind .segment.active")).to_have_text("Sauce or condiment")
    page.fill("#edit-text", "Chilli crisp\n- 200 ml oil\n- 3 tbsp chilli flakes")
    page.click("#edit-form button[type=submit]")
    expect(page.locator("#view-recipe")).to_be_visible()
    page.go_back()
    # Each sheet lists only its own kind
    expect(page.locator("#view-browse")).to_be_visible()
    expect(page.locator(".recipe-card-title")).to_have_text(["Chilli crisp"])
    close_recipe(page)
    page.click("#meals-toggle")
    expect(page.locator(".recipe-card-title")).to_have_text(["Miso Aubergine with Soba"])
    # Pulling the sheet down from the top closes it, like a recipe
    page.wait_for_timeout(400)
    swipe_down(page, 120, 400)
    expect(page.locator("#view-browse")).to_be_hidden()
    expect(page.locator("#recipe-count")).to_have_text("1")
    expect(page.locator("#sauce-count")).to_have_text("1")
    # The suggestion only picks meals
    expect(page.locator("#suggestion-link")).to_have_text("Miso Aubergine with Soba")
    expect(page.locator("#suggestion-next")).to_be_disabled()
    assert not page.evaluate("document.documentElement.scrollHeight > window.innerHeight")
    # Search finds both, with a label on the sauce
    page.fill("#search", "i")
    expect(page.locator(".recipe-card")).to_have_count(2)
    expect(page.locator(".recipe-card", has_text="Chilli crisp")).to_contain_text("Sauce or condiment")
    page.fill("#search", "")
    expect(page.locator("#view-browse")).to_be_hidden()
    # Changing the type moves it to the other row, and it survives a reload
    page.click("#sauces-toggle")
    page.click(".recipe-card")
    page.click("#edit-link")
    expect(page.locator("#edit-kind .segment.active")).to_have_text("Sauce or condiment")
    page.click("#edit-kind .segment[data-kind=meal]")
    page.click("#edit-form button[type=submit]")
    expect(page.locator("#view-recipe")).to_be_visible()
    page.goto(BASE)
    page.reload()
    expect(page.locator("#recipe-count")).to_have_text("2")
    expect(page.locator("#sauce-count")).to_have_text("0")
    assert not errors, errors
    print("meals and sauces: ok")


def test_pantry_categories(p, sheet):
    """Your own pantry categories, shared between two phones."""
    def device(name, **options):
        ctx = p.chromium.launch().new_context(**options)
        ctx.route(SHEET_URL, sheet.handle)
        ctx.add_init_script(
            f"if (!localStorage.getItem('kitchen.settings.v1')) localStorage.setItem('kitchen.settings.v1', JSON.stringify({{syncUrl: '{SHEET_URL}', myName: '{name}'}}))"
        )
        page = ctx.new_page()
        watch_errors(page, errors)
        page.goto(BASE + "#/pantry")
        return page

    errors = []
    page = device("Kadi", **p.devices["Pixel 7"])
    page.fill("#pantry-add-input", "Soy sauce")
    page.keyboard.press("Enter")
    page.fill("#pantry-add-input", "Basmati rice")
    page.keyboard.press("Enter")
    expect(page.locator(".shop-section", has_text="Oils, vinegars & sauces")).to_contain_text("Soy sauce")
    expect(page.locator(".shop-section", has_text="Grains, pasta & rice")).to_contain_text("Basmati rice")

    # Add a category: the keyboard stays closed, and a duplicate is refused
    page.click("#sections-open")
    expect(page.locator("#sections-dialog")).to_be_visible()
    assert page.evaluate("document.activeElement.tagName") == "H2"
    page.screenshot(path=SHOTS / "phone-pantry-categories.png")
    page.fill("#sections-add-input", "fridge")
    page.click("#sections-add")
    expect(page.locator("#sections-note")).to_contain_text("already")
    page.fill("#sections-add-input", "Top shelf")
    page.keyboard.press("Enter")
    expect(page.locator(".section-row input").last).to_have_value("Top shelf")
    expect(page.locator("#sections-dialog")).to_be_visible()  # Enter didn't close it
    # Move it up one
    page.click(".section-row:last-child [data-action=up]")
    expect(page.locator(".section-row input").nth(-2)).to_have_value("Top shelf")
    # Rename a category: its items follow
    rename = page.locator(".section-row input[aria-label='Name of Grains, pasta & rice']")
    rename.fill("Dry goods")
    page.keyboard.press("Enter")
    expect(page.locator(".section-row input[aria-label='Name of Dry goods']")).to_be_visible()
    page.click("#sections-form button[value=done]")
    expect(page.locator(".shop-section", has_text="Dry goods")).to_contain_text("Basmati rice")

    # Put an item in the new category
    page.click(".pantry-name:has-text('Soy sauce')")
    page.select_option("#pantry-section", "Top shelf")
    page.click("#pantry-form button[value=save]")
    expect(page.locator(".shop-section", has_text="Top shelf")).to_contain_text("Soy sauce")
    page.wait_for_timeout(2500)  # sync

    # The second device gets the same categories and order
    other = device("Tõnis", viewport={"width": 1366, "height": 768})
    expect(other.locator(".shop-section", has_text="Top shelf")).to_contain_text("Soy sauce")
    expect(other.locator(".shop-section", has_text="Dry goods")).to_contain_text("Basmati rice")
    other.keyboard.press("c")
    expect(other.locator("#sections-dialog")).to_be_visible()
    expect(other.locator(".section-row input").nth(-2)).to_have_value("Top shelf")
    # Removing a category moves its items to Other
    other.click(".section-row:has(input[aria-label='Name of Top shelf']) [data-action=remove]")
    other.click("#ask-dialog button[value=ok]")
    expect(other.locator(".section-row input[aria-label='Name of Top shelf']")).to_have_count(0)
    other.click("#sections-form button[value=done]")
    expect(other.locator(".shop-section", has_text="Other")).to_contain_text("Soy sauce")
    other.wait_for_timeout(2500)  # sync

    # It stays gone after a reload, on the first phone too
    page.reload()
    page.wait_for_timeout(1500)
    page.reload()
    expect(page.locator(".shop-section", has_text="Other")).to_contain_text("Soy sauce")
    expect(page.locator(".shop-section", has_text="Top shelf")).to_have_count(0)
    assert not errors, errors
    print("pantry categories: ok")


def test_recipe_layout(p):
    """Bottom buttons and the jump bar on a long recipe."""
    ctx = p.chromium.launch().new_context(**p.devices["Pixel 7"])
    ctx.add_init_script("if (!localStorage.getItem('kitchen.settings.v1')) localStorage.setItem('kitchen.settings.v1', JSON.stringify({myName: 'Kadi'}))")
    page = ctx.new_page()
    errors = []
    watch_errors(page, errors)
    page.goto(BASE)
    long_method = "\n".join(f"{n}. Stir the pot and wait a while." for n in range(1, 40))
    page.click("#add-recipe")
    page.fill("#edit-text", f"Long soup\n\nServes 2\n\n## Ingredients\n- 1 onion\n- 2 carrots\n\n## Method\n{long_method}\n\n## To serve\nEnjoy.")
    page.fill("#edit-notes", "More salt")
    page.click("#edit-form button[type=submit]")
    expect(page.locator("#view-recipe")).to_be_visible()
    # The dock shows on the recipe page only
    dock = page.locator("#recipe-dock")
    expect(dock).to_be_visible()
    page.wait_for_timeout(450)  # the sheet finishes rising
    assert page.evaluate("document.getElementById('recipe-dock').getBoundingClientRect().bottom") == page.evaluate("innerHeight")
    expect(page.locator(".jump-button")).to_have_text(["Notes", "Ingredients", "Method"])
    page.screenshot(path=SHOTS / "phone-recipe-dock.png")
    # Jumping brings the heading under the top bar, and marks it
    page.click(".jump-button:has-text('Method')")
    page.wait_for_timeout(900)
    top = page.evaluate("[...document.querySelectorAll('#recipe-body h1, #recipe-body h2, #recipe-body h3')].find((h) => h.textContent === 'Method').getBoundingClientRect().top")
    bar = page.evaluate("document.getElementById('view-recipe').getBoundingClientRect().top")
    assert bar <= top < bar + 40, (bar, top)
    expect(page.locator("#view-list")).to_be_visible()  # the page stays underneath
    expect(page.locator(".jump-button.active")).to_have_text("Method")
    page.click(".jump-button:has-text('Ingredients')")
    page.wait_for_timeout(900)
    expect(page.locator(".jump-button.active")).to_have_text("Ingredients")
    # The text can scroll clear of the dock
    page.evaluate("document.getElementById('view-recipe').scrollTo(0, 1e6)")
    page.wait_for_timeout(200)
    last = page.evaluate("document.getElementById('recipe-body').getBoundingClientRect().bottom")
    assert last <= page.evaluate("document.getElementById('recipe-dock').getBoundingClientRect().top") + 1, last
    # Further down the recipe, pulling down is an ordinary scroll
    swipe_down(page, 200, 500)
    page.wait_for_timeout(300)
    expect(page.locator("#view-recipe")).to_be_visible()
    page.evaluate("document.getElementById('view-recipe').scrollTo(0, 0)")
    page.go_back()
    expect(page.locator("#view-list")).to_be_visible()
    expect(page.locator("#view-recipe")).to_be_hidden()
    expect(dock).to_be_hidden()
    # A recipe without headings has no bar, and so no bottom bar at all
    page.click("#add-recipe")
    page.fill("#edit-text", "Toast\nPut butter on it.")
    page.click("#edit-form button[type=submit]")
    expect(page.locator("#view-recipe")).to_be_visible()
    expect(page.locator("#recipe-jump")).to_be_hidden()
    # "**Ingredients**" lines count as headings too
    page.click("#edit-link")
    page.fill("#edit-text", "Toast\n\n**Ingredients**\n- 1 slice bread\n\n**Method**\n1. Toast it.")
    page.click("#edit-form button[type=submit]")
    expect(page.locator(".jump-button")).to_have_text(["Ingredients", "Method"])
    assert not errors, errors
    print("recipe layout: ok")


def test_recipe_swipe(p):
    """Swiping through recipes: left skips, right adds, OK moves on."""
    ctx = p.chromium.launch().new_context(**p.devices["Pixel 7"])
    ctx.add_init_script("if (!localStorage.getItem('kitchen.settings.v1')) localStorage.setItem('kitchen.settings.v1', JSON.stringify({myName: 'Kadi'}))")
    page = ctx.new_page()
    errors = []
    watch_errors(page, errors)
    page.goto(BASE)
    for name in ["Apple soup", "Bean stew", "Corn cakes"]:
        page.click("#add-recipe")
        page.fill("#edit-text", f"{name}\n\nServes 2\n\n## Ingredients\n- 2 {name.split()[0].lower()}s\n\n## Method\n1. Cook it.")
        page.click("#edit-form button[type=submit]")
        expect(page.locator("#view-recipe")).to_be_visible()
        go_home(page)
        expect(page.locator("#view-list")).to_be_visible()
    expect(page.locator("#view-recipe")).to_be_hidden()
    title = page.locator("#recipe-title")
    page.click("#meals-toggle")
    cards = page.locator(".recipe-card-title").all_inner_texts()
    assert len(cards) == 3, cards
    page.locator(".recipe-card").first.click()
    expect(title).to_have_text(cards[0])
    # A small move does nothing; while dragging, a hint says what will happen
    swipe(page, 300, 275)
    page.wait_for_timeout(300)
    expect(title).to_have_text(cards[0])
    swipe(page, 330, 120, lift=False)
    page.wait_for_timeout(50)  # shows on the next screen refresh
    expect(page.locator("#swipe-hint")).to_have_text("Next recipe")
    page.evaluate("""() => {
        const t = new Touch({ identifier: 1, target: document.body, clientX: 330, clientY: 400 });
        document.body.dispatchEvent(new TouchEvent("touchcancel", { touches: [], changedTouches: [t], bubbles: true }));
    }""")
    expect(page.locator("#swipe-hint")).to_be_hidden()
    page.wait_for_timeout(350)
    # Left: the next recipe
    swipe(page, 330, 120)
    expect(title).to_have_text(cards[1])
    page.wait_for_timeout(400)
    # Right: into the plan, the notice waits for OK, then the next recipe
    swipe(page, 90, 300)
    expect(page.locator("#added-dialog")).to_be_visible()
    expect(page.locator("#added-title")).to_have_text("Added to the cooking plan")
    assert page.evaluate("document.activeElement.tagName") == "H2"
    expect(title).to_have_text(cards[1])
    expect(page.locator("#plan-count")).to_have_text("1")
    # Cancel: as if it never happened, even when it started the list
    page.click("#added-dialog button[value=cancel]")
    expect(page.locator("#toast")).to_contain_text("Taken out of the plan")
    expect(title).to_have_text(cards[1])
    expect(page.locator("#plan-count")).to_have_text("0")
    page.wait_for_timeout(400)
    # Swipe again, this time for real
    swipe(page, 90, 300)
    expect(page.locator("#added-title")).to_have_text("Added to the cooking plan")
    expect(page.locator("#plan-count")).to_have_text("1")
    page.click("#added-dialog button[value=ok]")
    expect(title).to_have_text(cards[2])
    page.wait_for_timeout(400)
    # Back returns to the list, not through the swiped recipes
    page.go_back()
    expect(page.locator("#view-list")).to_be_visible()
    expect(page.locator("#view-recipe")).to_be_hidden()
    # Already on the list: not added twice
    page.locator(".recipe-card", has_text=cards[1]).click()
    expect(title).to_have_text(cards[1])
    page.wait_for_timeout(400)
    swipe(page, 90, 300)
    expect(page.locator("#added-title")).to_have_text("Already in the plan")
    expect(page.locator("#plan-count")).to_have_text("1")
    page.click("#added-dialog button[value=ok]")
    expect(title).to_have_text(cards[2])
    page.wait_for_timeout(400)
    # Cancel on a list that already has things: the rest stays
    page.wait_for_timeout(400)
    swipe(page, 90, 300)
    expect(page.locator("#added-title")).to_have_text("Added to the cooking plan")
    expect(page.locator("#plan-count")).to_have_text("2")
    page.keyboard.press("Escape")
    expect(page.locator("#plan-count")).to_have_text("1")
    expect(page.locator("#added-dialog")).to_be_hidden()
    expect(title).to_have_text(cards[2])
    # Changed your mind again: it can be added after all
    page.wait_for_timeout(400)
    swipe(page, 90, 300)
    expect(page.locator("#added-title")).to_have_text("Added to the cooking plan")
    expect(page.locator("#plan-count")).to_have_text("2")
    page.keyboard.press("Escape")
    expect(page.locator("#plan-count")).to_have_text("1")
    # Pulling down from the top closes the recipe; a small pull doesn't
    swipe_down(page, 300, 340)
    page.wait_for_timeout(400)
    expect(page.locator("#view-recipe")).to_be_visible()
    swipe_down(page, 200, 500)
    expect(page.locator("#view-list")).to_be_visible()
    expect(page.locator("#view-recipe")).to_be_hidden()
    page.locator(".recipe-card", has_text=cards[2]).click()
    expect(title).to_have_text(cards[2])
    page.wait_for_timeout(400)
    # After the last one: back to the list it came from, with a message
    swipe(page, 330, 120)
    expect(page.locator("#view-browse")).to_be_visible()
    expect(page.locator("#view-recipe")).to_be_hidden()
    expect(page.locator("#toast")).to_contain_text("That was the last recipe")
    # From the suggestion, it goes on through the other ideas
    close_recipe(page)
    page.reload()
    shown = page.locator("#suggestion-link").inner_text()
    # Undo goes back to the previous idea, and is gone at the first one
    expect(page.locator("#suggestion-previous")).to_be_disabled()
    page.click("#suggestion-next")
    expect(page.locator("#suggestion-link")).not_to_have_text(shown)
    page.click("#suggestion-previous")
    expect(page.locator("#suggestion-link")).to_have_text(shown)
    expect(page.locator("#suggestion-previous")).to_be_disabled()
    page.wait_for_timeout(500)  # the soft fade finishes
    # Anywhere on the panel opens it, but "Another idea" is still its own button
    for part in ("#suggestion-label", "#suggestion-reason"):
        assert page.evaluate(f"""(() => {{
            const r = document.querySelector('{part}').getBoundingClientRect();
            return document.elementFromPoint(r.x + 5, r.y + r.height / 2).id;
        }})()""") == "suggestion-link", part
    assert page.evaluate("""(() => {
        const r = document.getElementById('suggestion-next').getBoundingClientRect();
        return document.elementFromPoint(r.x + 5, r.y + r.height / 2).id;
    })()""") == "suggestion-next"
    # The switched-off back arrow is hidden; a tap there, or between the
    # arrows, opens the recipe like the rest of the card
    expect(page.locator("#suggestion-previous")).to_be_hidden()
    box = page.locator("#suggestion").bounding_box()
    page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] - 20)  # between
    expect(title).to_have_text(shown)
    close_recipe(page)
    page.wait_for_timeout(500)
    page.mouse.click(box["x"] + 24, box["y"] + box["height"] - 20)  # where "back" would be
    expect(title).to_have_text(shown)
    page.wait_for_timeout(400)
    swipe(page, 330, 120)
    expect(title).not_to_have_text(shown)
    # The keyboard does the same
    page.wait_for_timeout(400)
    before = title.inner_text()
    page.keyboard.press("ArrowRight")
    expect(title).not_to_have_text(before)
    assert not errors, errors
    print("recipe swipe: ok")


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
        expect(page.locator("#meals-toggle")).to_be_visible()
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


def test_screen_stays_on(p):
    """While a recipe is open the screen stays on (Screen Wake Lock)."""
    ctx = p.chromium.launch().new_context(**p.devices["Pixel 7"])
    ctx.add_init_script("if (!localStorage.getItem('kitchen.settings.v1')) localStorage.setItem('kitchen.settings.v1', JSON.stringify({myName: 'Kadi'}))")
    # A stand-in wake lock that counts how often it's held
    ctx.add_init_script("""
        window.__locks = 0;
        Object.defineProperty(navigator, 'wakeLock', { value: { request: async () => {
            window.__locks += 1;
            const lock = new EventTarget();
            lock.release = async () => { window.__locks -= 1; lock.dispatchEvent(new Event('release')); };
            return lock;
        } } });
    """)
    page = ctx.new_page()
    errors = []
    watch_errors(page, errors)
    page.goto(BASE)
    locks = lambda: page.evaluate("window.__locks")
    page.click("#add-recipe")
    page.fill("#edit-text", RECIPE)
    page.click("#edit-form button[type=submit]")
    expect(page.locator("#view-recipe")).to_be_visible()
    page.wait_for_function("window.__locks === 1")
    # Closing the recipe lets the screen dim again
    page.go_back()
    expect(page.locator("#view-recipe")).to_be_hidden()
    page.wait_for_function("window.__locks === 0")
    # Opening it again takes the lock again, once
    show_meals(page)
    page.click(".recipe-card")
    expect(page.locator("#view-recipe")).to_be_visible()
    page.wait_for_function("window.__locks === 1")
    page.wait_for_timeout(300)
    assert locks() == 1, locks()
    assert not errors, errors
    ctx.close()
    print("screen stays on: ok")


TIMER_RECIPE = """Quick toast
Serves 1

## Method
1. Roast at 220 °C for 20 minutes.
2. Toast the seeds 2 seconds, then rest 5 min."""


def test_timers(p):
    """Times in a recipe start timers; several run at once; time's up rings."""
    ctx = p.chromium.launch().new_context(**p.devices["Pixel 7"])
    ctx.add_init_script("if (!localStorage.getItem('kitchen.settings.v1')) localStorage.setItem('kitchen.settings.v1', JSON.stringify({myName: 'Kadi'}))")
    ctx.add_init_script("window.__buzz = 0; navigator.vibrate = (pattern) => { if (pattern) window.__buzz += 1; return true; };")
    page = ctx.new_page()
    errors = []
    watch_errors(page, errors)
    page.goto(BASE)
    page.click("#add-recipe")
    page.fill("#edit-text", TIMER_RECIPE)
    page.click("#edit-form button[type=submit]")
    expect(page.locator("#view-recipe")).to_be_visible()
    links = page.locator("#recipe-body .time-link")
    expect(links).to_have_text(["20 minutes", "2 seconds", "5 min"])
    expect(page.locator("#timer-strip")).to_be_hidden()
    # Two timers at once, named after their step
    links.nth(0).click()
    expect(page.locator("#toast")).to_contain_text("Timer started: Roast, 20:00")
    links.nth(2).click()
    chips = page.locator(".timer-chip")
    expect(chips).to_have_count(2)
    expect(chips.locator(".timer-name")).to_have_text(["Roast", "Rest"])
    expect(chips.nth(0).locator(".timer-time")).to_have_text(re.compile(r"^19:5\d$"))
    # A second tap on the same time doesn't start a twin
    links.nth(0).click()
    expect(page.locator("#toast")).to_contain_text("Roast is already running")
    expect(chips).to_have_count(2)
    # Tap the clock to pause, again to go on; × stops it
    chips.nth(1).locator(".timer-time").click()
    expect(chips.nth(1)).to_have_class(re.compile("paused"))
    paused = chips.nth(1).locator(".timer-time").inner_text()
    page.wait_for_timeout(1300)
    expect(chips.nth(1).locator(".timer-time")).to_have_text(paused)
    chips.nth(1).locator(".timer-time").click()
    expect(chips.nth(1)).not_to_have_class(re.compile("paused"))
    chips.nth(1).locator(".timer-stop").click()
    expect(chips).to_have_count(1)
    # The chips stay on every page, and survive a reload
    close_recipe(page)
    expect(page.locator("#timer-strip")).to_be_visible()
    page.reload()
    expect(chips).to_have_count(1)
    expect(chips.locator(".timer-name")).to_have_text("Roast")
    # The chip's name opens its recipe
    chips.locator(".timer-name").click()
    expect(page.locator("#view-recipe")).to_be_visible()
    expect(page.locator("#recipe-title")).to_have_text("Quick toast")
    # Time's up: the chip turns green, buzzes, and Done (or X) stops it
    page.locator("#recipe-body .time-link").nth(1).click()
    ringing = page.locator(".timer-chip.ringing")
    expect(ringing).to_have_count(1, timeout=6000)
    expect(ringing.locator(".timer-time")).to_have_text("Done")
    page.wait_for_function("window.__buzz >= 1")
    page.screenshot(path=SHOTS / "phone-timers.png")
    ringing.locator(".timer-time").click()
    expect(ringing).to_have_count(0)
    page.locator("#recipe-body .time-link").nth(1).click()
    expect(ringing).to_have_count(1, timeout=6000)
    page.evaluate("document.activeElement.blur()")
    page.keyboard.press("x")
    expect(ringing).to_have_count(0)
    expect(chips).to_have_count(1)  # Roast keeps going
    chips.locator(".timer-stop").click()
    expect(page.locator("#timer-strip")).to_be_hidden()
    assert not errors, errors
    ctx.close()
    print("timers: ok")


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
            test_meals_and_sauces(p)
            test_recipe_layout(p)
            test_recipe_swipe(p)
            test_screen_stays_on(p)
            test_timers(p)
            test_pantry_categories(p, FakeSheet())
            test_site_missing(p)
            test_update_after_publish(p)
        print(f"all browser tests passed ({sheet.calls} sync calls)")
    finally:
        server.terminate()


if __name__ == "__main__":
    main()
