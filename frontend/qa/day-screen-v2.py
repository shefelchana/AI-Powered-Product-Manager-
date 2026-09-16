"""Экран дня v2: приветствие с поддержкой, нет поля для фраз, сетка форм у глагола, фразы тьютора (или понятная заметка);
своя фраза добавляется на карточке во вкладке «Слова»."""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1]; OUT = sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 900})
    errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(BASE); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(500)
    pg.locator(".nav button").nth(0).click(); pg.wait_for_timeout(1500)
    day = pg.locator(".day").inner_text()
    print("welcome:", pg.locator(".welcome").inner_text() if pg.locator(".welcome").count() else "-", "|", pg.locator(".support").inner_text()[:70] if pg.locator(".support").count() else "-")
    assert pg.locator(".welcome").count() == 1, "нет приветствия"
    assert pg.locator(".day textarea").count() == 0, "поле для фраз всё ещё на экране дня"
    print("forms grid:", pg.locator(".forms-grid").count(), "| tutor phrases:", pg.locator(".day-phrases").count(), "| note:", [t for t in day.split("\n") if "тьютор" in t][:2])
    pg.screenshot(path=f"{OUT}/day-v2.png", full_page=True)
    pg.locator(".nav button").nth(3).click(); pg.wait_for_timeout(600)
    pg.locator(".word-row").first.click(); pg.wait_for_timeout(500)
    assert pg.locator(".own-phrase textarea").count() == 1, "на карточке нет формы своей фразы"
    pg.locator(".own-phrase textarea").fill("משפט לבדיקה"); pg.locator(".own-phrase button").click(); pg.wait_for_timeout(1200)
    if pg.locator(".word-card").count() == 0: pg.locator(".word-row").first.click(); pg.wait_for_timeout(400)   # карточка могла закрыться после перезагрузки списка
    assert "משפט לבדיקה" in pg.locator(".word-card").inner_text(), "фраза не появилась на карточке"
    print("pageerrors:", errors); assert errors == []
    b.close()
print("DAY V2 QA OK")
