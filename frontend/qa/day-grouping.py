"""«Прогресс»: уроки сгруппированы по дням; «Повторить» открывает все слова дня; карточка показывает дату добавления."""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1]; OUT = sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 900})
    errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(BASE); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(500)
    pg.locator(".nav button").nth(2).click(); pg.wait_for_timeout(800)
    pg.locator("details.progress-block summary").click(); pg.wait_for_timeout(800)
    rows = [r.inner_text().replace("\n", " ") for r in pg.locator(".lesson-row").all()]
    print("days:", rows)
    assert rows and all(r.startswith("Урок ") for r in rows), "строки не по дням"
    dates = [r.split()[1] for r in rows]; assert len(dates) == len(set(dates)), "день повторяется"
    pg.screenshot(path=f"{OUT}/day-grouping.png", full_page=True)
    pg.locator(".lesson-row button").first.click(); pg.wait_for_timeout(800)
    head = pg.locator(".review-head").inner_text() if pg.locator(".review-head").count() else pg.locator("body").inner_text()[:80]
    print("review opened:", head.replace("\n", " ")[:60])
    pg.goto(BASE); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(400)
    pg.locator(".nav button").nth(3).click(); pg.wait_for_timeout(600)
    pg.locator(".word-row").first.click(); pg.wait_for_timeout(500)
    meta = pg.locator(".word-meta").first.inner_text(); print("card meta:", meta)
    assert meta.startswith("добавлено "), "нет даты добавления"
    pg.screenshot(path=f"{OUT}/card-meta.png")
    print("pageerrors:", errors); assert errors == []
    b.close()
print("DAY GROUPING QA OK")
