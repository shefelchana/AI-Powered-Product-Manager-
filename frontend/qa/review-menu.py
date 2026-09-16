"""Меню «Повторять»: на виду две кнопки, остальное под «Другие способы»."""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1]; OUT = sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 900})
    errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(BASE); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(500)
    pg.locator(".nav button").nth(2).click(); pg.wait_for_timeout(800)
    visible = [b.inner_text() for b in pg.locator(".review-menu > button").all()]
    print("visible buttons:", visible)
    assert len(visible) == 2, "на виду должно быть две кнопки"
    assert pg.locator(".more-ways[open]").count() == 0, "«Другие способы» раскрыты по умолчанию"
    pg.screenshot(path=f"{OUT}/review-menu.png")
    pg.locator("summary", has_text="Другие способы").click(); pg.wait_for_timeout(300)
    hidden = [b.inner_text() for b in pg.locator(".more-ways button").all()]
    print("more:", hidden)
    assert any("Произношение" in h for h in hidden) and any("четырёх" in h for h in hidden)
    print("pageerrors:", errors); assert errors == []
    b.close()
print("REVIEW MENU QA OK")
