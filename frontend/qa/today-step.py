"""Экран дня: блок «Сегодня» с одним шагом и кнопкой «Начать»; кнопка ведёт на нужный экран."""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1]; OUT = sys.argv[2]
FAKE_AUDIO = "class FakeAudio { constructor(s){this.src=s;} play(){ return Promise.resolve(); } pause(){} } window.Audio = FakeAudio;"
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 420, "height": 860})
    pg.add_init_script(FAKE_AUDIO); errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(BASE); pg.wait_for_load_state("networkidle")
    pg.get_by_role("button", name="Слово дня").click(); pg.wait_for_timeout(800)
    assert pg.locator(".today").count() == 1, "нет блока «Сегодня»"
    title = pg.locator(".today-title").inner_text(); text = pg.locator(".today").inner_text()
    print("today:", text.replace("\n", " / "))
    pg.screenshot(path=f"{OUT}/today-step.png")
    pg.get_by_role("button", name="Начать").click(); pg.wait_for_timeout(600)
    if title.startswith("Повторить:"):
        assert pg.get_by_role("button", name="Фразы: формы и предлоги").count() == 1, "не открылось меню повторения"
        print("→ меню повторения открыто")
    elif title.startswith("Эхо"):
        assert "слушай" in pg.locator(".prompt-label").inner_text(); print("→ эхо открыто")
    elif title.startswith("Фразы"):
        assert pg.locator(".prompt-label").count() == 1; print("→ фразы открыты")
    elif title.startswith("Повторить урок"):
        assert pg.locator(".review").count() >= 1; print("→ прогон урока открыт")
    print("pageerrors:", errors); assert errors == []
    b.close()
print("TODAY QA OK")
