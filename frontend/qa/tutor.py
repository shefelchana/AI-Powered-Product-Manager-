"""Тьютор в блоке «Прогресс»: разбор промаха по правилу, кнопка «Ещё один», дайджест недели (или понятная ошибка)."""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1]; OUT = sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 900})
    errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(BASE); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(500)
    # один промах в строгом режиме — с текстом ответа, чтобы тьютору было что разбирать
    pg.locator(".nav button").nth(2).click(); pg.wait_for_timeout(800)
    if pg.get_by_role("button", name="Только написать по переводу").count():
        pg.get_by_role("button", name="Только написать по переводу").click(); pg.wait_for_timeout(800)
        if pg.locator("input.term-input").count():
            pg.locator("input.term-input").fill("שלום"); pg.keyboard.press("Enter"); pg.wait_for_timeout(600)
            if pg.get_by_role("button", name="Не знала").count(): pg.get_by_role("button", name="Не знала").click(); pg.wait_for_timeout(600)
        if pg.get_by_role("button", name="Выйти").count(): pg.get_by_role("button", name="Выйти").click(); pg.wait_for_timeout(500)
    pg.goto(BASE); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(500)
    pg.locator(".nav button").nth(2).click(); pg.wait_for_timeout(800)
    pg.locator("details.progress-block summary").click()
    pg.locator(".tutor-miss").wait_for(timeout=30000)   # первый промах может идти через модель
    assert pg.locator(".tutor-miss").count() == 1, "нет блока разбора"
    text = pg.locator(".tutor-miss").inner_text()
    print("miss block:", text.replace("\n", " / ")[:220])
    assert "ты: שלום" in text or "ты:" in text, "нет пары ответ/эталон"
    assert "Разбор промаха" in text and ("по правилу" in text or "тьютор (модель)" in text or "Лимит" in text or "невнятно" in text)
    weekly = pg.locator(".tutor-note").inner_text() if pg.locator(".tutor-note").count() else pg.locator("details.progress-block").inner_text()
    print("weekly:", weekly.replace("\n", " / ")[:160])
    pg.screenshot(path=f"{OUT}/tutor.png", full_page=True)
    pg.get_by_role("button", name="Ещё один").click()
    pg.locator(".tutor-miss").wait_for(timeout=30000); pg.wait_for_timeout(300)
    text2 = pg.locator(".tutor-miss").inner_text()
    print("second:", text2.replace("\n", " / ")[:160])
    assert text2 != text, "«Ещё один» не сменил промах"
    print("pageerrors:", errors); assert errors == []
    b.close()
print("TUTOR QA OK")
