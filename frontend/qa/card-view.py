"""Карточка слова: по умолчанию просмотр (без полей ввода), «Изменить» открывает форму, «Сохранить» возвращает в просмотр,
служебного текста про ключ нет."""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1]; OUT = sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 900})
    errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(BASE); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(500)
    pg.locator(".nav button").nth(3).click(); pg.wait_for_timeout(600)
    pg.locator(".word-row").first.click(); pg.wait_for_timeout(500)
    card = pg.locator(".word-card"); assert card.count() == 1
    assert card.locator("input").count() == 0, "в режиме просмотра есть поля ввода"
    assert "GEMINI_API_KEY" not in card.inner_text(), "служебный текст про ключ на карточке"
    print("view:", card.inner_text().replace("\n", " / ")[:160])
    pg.screenshot(path=f"{OUT}/card-view.png", full_page=True)
    pg.get_by_role("button", name="Изменить").click(); pg.wait_for_timeout(300)
    assert pg.locator(".word-card input").count() >= 2, "форма не открылась"
    pg.screenshot(path=f"{OUT}/card-edit.png", full_page=True)
    tr = pg.locator(".word-card input").nth(1); old = tr.input_value()
    try:
        # взвести удаление, сохранить, снова открыть форму: «Точно удалить» не должно остаться взведённым
        pg.get_by_role("button", name="Удалить слово").click(); pg.wait_for_timeout(100)
        assert pg.get_by_role("button", name="Точно удалить").count() == 1
        tr.fill(old + " ✓")
        pg.get_by_role("button", name="Сохранить").click(); pg.wait_for_timeout(1200)
        if pg.locator(".word-card").count() == 0: pg.locator(".word-row").first.click(); pg.wait_for_timeout(400)
        assert pg.locator(".word-card input").count() == 0, "после сохранения не вернулись в просмотр"
        assert "✓" in pg.locator(".word-card").inner_text(), "правка не видна"
        pg.get_by_role("button", name="Изменить").click(); pg.wait_for_timeout(200)
        assert pg.get_by_role("button", name="Точно удалить").count() == 0, "подтверждение удаления пережило сохранение"
        pg.get_by_role("button", name="Отмена").click(); pg.wait_for_timeout(200)
        assert pg.locator(".word-card input").count() == 0
    finally:
        if pg.locator(".word-card input").count() == 0:
            if pg.locator(".word-card").count() == 0: pg.locator(".word-row").first.click(); pg.wait_for_timeout(300)
            pg.get_by_role("button", name="Изменить").click(); pg.wait_for_timeout(200)
        pg.locator(".word-card input").nth(1).fill(old); pg.get_by_role("button", name="Сохранить").click(); pg.wait_for_timeout(1000)
    print("pageerrors:", errors); assert errors == []
    b.close()
print("CARD VIEW QA OK")
