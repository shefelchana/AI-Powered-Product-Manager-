"""Браузерная проверка «Слушать до текста»: диктант → этап прослушивания → написать → ответ со звуком."""
import sys, time
from playwright.sync_api import sync_playwright
BASE = sys.argv[1]; OUT = sys.argv[2]
FAKE_AUDIO = """
window.__plays = [];
class FakeAudio { constructor(src){ this.src = src; } play(){ window.__plays.push(this.src); return Promise.resolve(); } pause(){} }
window.Audio = FakeAudio;
"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 420, "height": 860})
    pg.add_init_script(FAKE_AUDIO)
    errors = []; pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None); pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(BASE); pg.wait_for_load_state("networkidle")
    pg.get_by_role("button", name="Повторять").first.click(); pg.wait_for_timeout(500)
    pg.get_by_role("button", name="Фразы: формы, предлоги, отрицания").click()
    pg.wait_for_timeout(1500)
    found = False
    for i in range(12):
        label = pg.locator(".prompt-label").inner_text()
        if "на слух" in label:
            found = True; break
        # другой тип — сдаться и дальше
        pg.get_by_role("button", name="Не помню").click(); pg.get_by_role("button", name="Дальше").click(); pg.wait_for_timeout(200)
    assert found, "диктант не встретился"
    time.sleep(0.5)
    plays = pg.evaluate("window.__plays.length")
    print("autoplay counted:", plays, "| label:", label)
    print("count text:", pg.locator(".listen-count").inner_text(), "| hint:", pg.locator(".listen-hint").inner_text())
    assert pg.locator("textarea").count() == 0, "поле ввода видно на этапе прослушивания"
    pg.screenshot(path=f"{OUT}/listen-1.png")
    pg.get_by_role("button", name="Послушать ещё раз").click(); pg.wait_for_timeout(200)
    print("after 2nd play:", pg.locator(".listen-count").inner_text(), "|", pg.locator(".listen-hint").inner_text())
    pg.get_by_role("button", name="Послушать ещё раз").click(); pg.wait_for_timeout(200)
    print("after 3rd play:", pg.locator(".listen-count").inner_text(), "|", pg.locator(".listen-hint").inner_text())
    pg.screenshot(path=f"{OUT}/listen-2.png")
    pg.get_by_role("button", name="Написать").click(); pg.wait_for_timeout(200)
    assert pg.locator("textarea").count() == 1, "поле ввода не появилось"
    print("write stage label:", pg.locator(".prompt-label").inner_text())
    pg.screenshot(path=f"{OUT}/write.png")
    pg.locator("textarea").fill("שלום"); before = pg.evaluate("window.__plays.length")
    pg.get_by_role("button", name="Проверить").click(); pg.wait_for_timeout(500)
    after = pg.evaluate("window.__plays.length")
    print("verdict autoplay:", after - before, "| verdict text:", pg.locator(".verdict").inner_text()[:160].replace("\n"," / "))
    pg.screenshot(path=f"{OUT}/verdict.png")
    assert after - before == 1, "ответ появился без звука"
    pg.get_by_role("button", name="Дальше").click(); pg.wait_for_timeout(200)
    print("next unit label:", pg.locator(".prompt-label").inner_text(), "| plays reset? listen-count:", pg.locator(".listen-count").inner_text() if pg.locator(".listen-count").count() else "n/a")
    # второй диктант в том же подходе: счётчик начинается заново (autoplay = 1), а не продолжает
    for i in range(12):
        label = pg.locator(".prompt-label").inner_text()
        if "на слух" in label: break
        if pg.get_by_role("button", name="Не помню").count(): pg.get_by_role("button", name="Не помню").click()
        elif pg.get_by_role("button", name="Не разобрала").count(): pg.get_by_role("button", name="Не разобрала").click()
        else: break
        pg.get_by_role("button", name="Дальше").click(); pg.wait_for_timeout(200)
    if "на слух" in pg.locator(".prompt-label").inner_text():
        pg.wait_for_timeout(300)
        print("second dictation count:", pg.locator(".listen-count").inner_text())
        assert pg.locator(".listen-count").inner_text().endswith(" 1"), "счётчик не сбросился"
    else:
        print("second dictation: not reached")
    print("console errors:", errors)
    b.close()
print("QA OK")
