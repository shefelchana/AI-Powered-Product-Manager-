"""«Прогресс»: строка с долей ошибок на сайте ульпана по датам."""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1]; OUT = sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 900})
    pg.goto(BASE); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(500)
    pg.locator(".nav button").nth(2).click(); pg.wait_for_timeout(800)
    pg.locator("details.progress-block summary").click(); pg.wait_for_timeout(800)
    t = pg.locator(".site-trend").inner_text(); print("trend:", t)
    assert "Ошибки на сайте" in t and "%" in t and "→" in t
    pg.screenshot(path=f"{OUT}/site-trend.png", full_page=True)
    b.close()
print("SITE TREND QA OK")
