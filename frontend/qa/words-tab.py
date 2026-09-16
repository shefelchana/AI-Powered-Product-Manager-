"""Вкладка «Слова»: поиск, секция «Нужен перевод», термин одной строкой; «Фразы» при сбое сети — одно сообщение и повтор."""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1]; OUT = sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 844})
    errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(BASE); pg.wait_for_load_state("networkidle")
    pg.locator(".nav button").nth(3).click(); pg.wait_for_timeout(600)
    assert pg.locator(".words-search").count() == 1, "нет поиска"
    labels = [l.inner_text() for l in pg.locator(".words-section .field-label").all()]
    print("sections:", labels)
    assert any(l.startswith("Нужен перевод") for l in labels) and any(l.startswith("С переводом") for l in labels), "секций нет"
    # длинный термин: перевод не накладывается на иврит, страница не уезжает вбок
    for r in pg.locator(".word-row").all():
        t = r.locator(".word-row-term").bounding_box(); tr = r.locator(".word-row-tr").bounding_box()
        if t and tr: assert tr["x"] + tr["width"] <= t["x"] + 1 or t["x"] + t["width"] <= tr["x"] + 1, f"наложение: {r.inner_text()[:40]}"
    assert pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "горизонтальная прокрутка"
    # термин из двух слов — одной строкой
    term = pg.get_by_text("להתחרט על", exact=True).first
    box = term.bounding_box(); print("term box h:", box["height"])
    assert box["height"] < 60, "термин переносится на две строки (одна строка при 1.5rem ≈ 48 px)"
    pg.screenshot(path=f"{OUT}/words-tab.png")
    pg.locator(".words-search").fill("סביר"); pg.wait_for_timeout(300)
    rows = pg.locator(".word-row").count(); print("rows after search:", rows)
    assert rows == 1
    pg.locator(".words-search").fill("раска"); pg.wait_for_timeout(300)
    assert pg.locator(".word-row").count() == 1, "поиск по переводу"
    pg.locator(".words-search").fill("zzz"); pg.wait_for_timeout(300)
    assert "Ничего не нашлось" in pg.locator("body").inner_text()
    pg.screenshot(path=f"{OUT}/words-search-empty.png")
    # «Фразы» при сбое сети
    pg.route("**/api/practice/**", lambda route, req: route.abort())
    pg.locator(".nav button").nth(2).click(); pg.wait_for_timeout(400)
    pg.get_by_role("button", name="Фразы: формы и предлоги").click(); pg.wait_for_timeout(1500)
    text = pg.locator(".done").inner_text() if pg.locator(".done").count() else pg.locator("body").inner_text()
    print("practice failure:", text.replace("\n", " / ")[:120])
    assert "Не получилось загрузить" in text and "Пока нечего тренировать" not in text
    assert pg.get_by_role("button", name="Повторить").count() == 1
    pg.screenshot(path=f"{OUT}/practice-offline.png")
    pg.unroute("**/api/practice/**")
    pg.get_by_role("button", name="Повторить").click(); pg.wait_for_timeout(2500)
    assert pg.locator(".prompt-label").count() == 1, "повтор не перезагрузил практику"
    print("retry ok; pageerrors:", errors); assert errors == []
    b.close()
print("WORDS TAB QA OK")
