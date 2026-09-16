"""Звук не загрузился (play() отклоняется): ученица не заперта — есть сообщение и кнопка «Написать»."""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1]; OUT = sys.argv[2]
FAKE = "class FakeAudio { constructor(s){this.src=s;} play(){ return Promise.reject(new Error('404')); } pause(){} } window.Audio = FakeAudio;"
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 420, "height": 860})
    pg.add_init_script(FAKE); errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(BASE); pg.wait_for_load_state("networkidle")
    pg.get_by_role("button", name="Повторять").first.click(); pg.wait_for_timeout(500)
    pg.get_by_role("button", name="Фразы: диктанты, формы, отрицания").click(); pg.wait_for_timeout(1500)
    for i in range(12):
        if "на слух" in pg.locator(".prompt-label").inner_text(): break
        pg.get_by_role("button", name="Не помню").click(); pg.get_by_role("button", name="Дальше").click(); pg.wait_for_timeout(200)
    pg.wait_for_timeout(300)
    hint = pg.locator(".listen-hint").inner_text()
    print("hint:", hint, "| count:", pg.locator(".listen-count").inner_text())
    assert "не загрузился" in hint, "нет сообщения о сбое звука"
    assert pg.get_by_role("button", name="Написать").count() == 1, "«Написать» недоступна при сбое звука"
    pg.screenshot(path=f"{OUT}/audio-failed.png")
    pg.get_by_role("button", name="Написать").click(); pg.wait_for_timeout(200)
    assert pg.locator("textarea").count() == 1
    print("pageerrors:", errors); print("QA FAIL-SCENARIO OK")
    b.close()
