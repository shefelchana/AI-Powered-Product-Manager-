"""Карточка слова: блок фраз с фразами преподавателя — огласовки, перевод, кнопка 🔊."""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1]; OUT = sys.argv[2]; WORD = sys.argv[3] if len(sys.argv) > 3 else "להפר"
FAKE_AUDIO = "class FakeAudio { constructor(s){this.src=s;} play(){ (window.__plays ||= []).push(this.src); return Promise.resolve(); } pause(){} } window.Audio = FakeAudio;"
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 420, "height": 900})
    pg.add_init_script(FAKE_AUDIO); errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(BASE); pg.wait_for_load_state("networkidle")
    pg.get_by_role("button", name="Слова").first.click(); pg.wait_for_timeout(500)
    pg.get_by_text(WORD, exact=True).first.click(); pg.wait_for_timeout(500)
    # раскрыть карточку, если нужно (кнопки «Показать»/«Не понял — перевод» и т.п.)
    for name in ["Показать", "Не понял — перевод", "Объяснение"]:
        if pg.get_by_role("button", name=name).count(): pg.get_by_role("button", name=name).first.click(); pg.wait_for_timeout(300)
    items = pg.locator(".examples li.phrase-lesson")
    print("lesson phrases on card:", items.count())
    assert items.count() >= 1, "фраз урока на карточке нет"
    first = items.first
    print("first:", first.inner_text().replace("\n", " / ")[:120])
    assert first.locator(".listen-again").count() == 1, "нет кнопки аудио"
    first.locator(".listen-again").click(); pg.wait_for_timeout(200)
    src = pg.evaluate("window.__plays[window.__plays.length-1]")
    print("audio src:", src[:80]); assert "sentences-audio" in src or src.startswith("http")
    pg.screenshot(path=f"{OUT}/lesson-phrases.png", full_page=True)
    print("pageerrors:", errors); assert errors == []
    b.close()
print("LESSON PHRASES QA OK")
