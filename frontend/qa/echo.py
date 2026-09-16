"""«Эхо»: слушай → запиши (фейковый микрофон Chromium) → сравни → дальше; и сценарий «микрофон запрещён»."""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1]; OUT = sys.argv[2]
FAKE_AUDIO = "class FakeAudio { constructor(s){this.src=s;} play(){ (window.__plays ||= []).push(this.src); return Promise.resolve(); } pause(){} } window.Audio = FakeAudio;"

def open_echo(pg):
    pg.goto(BASE); pg.wait_for_load_state("networkidle")
    pg.get_by_role("button", name="Повторять").first.click(); pg.wait_for_timeout(400)
    if pg.locator("summary", has_text="Другие способы").count(): pg.locator("summary", has_text="Другие способы").click(); pg.wait_for_timeout(200)
    pg.get_by_role("button", name="Произношение: повтори за преподавателем").click()

with sync_playwright() as p:
    # 1. Микрофон есть (фейковое устройство, разрешение выдаётся автоматически)
    b = p.chromium.launch(args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"])
    ctx = b.new_context(viewport={"width": 420, "height": 860}, permissions=["microphone"])
    pg = ctx.new_page(); pg.add_init_script(FAKE_AUDIO); errors = []; uploads = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    # Приватность: за весь подход со страницы не уходит ни одного POST/PUT (голос остаётся в браузере).
    pg.on("request", lambda r: uploads.append((r.method, r.url)) if r.method in ("POST", "PUT", "PATCH") else None)
    open_echo(pg)
    print("step:", pg.locator(".prompt-label").inner_text(), "| head:", pg.locator(".review-head").inner_text().replace("\n", " "))
    assert pg.evaluate("(window.__plays||[]).length") == 1, "эталон не проиграл сам"
    pg.screenshot(path=f"{OUT}/echo-listen.png")
    pg.get_by_role("button", name="Записать себя").dblclick()   # двойное нажатие — один рекордер, не два
    pg.locator(".prompt-label", has_text="запись").wait_for(timeout=8000)   # микрофон стартует не мгновенно
    pg.wait_for_timeout(400)
    print("step:", pg.locator(".prompt-label").inner_text())
    pg.screenshot(path=f"{OUT}/echo-recording.png")
    pg.get_by_role("button", name="Стоп").click()
    pg.locator(".prompt-label", has_text="сравни").wait_for(timeout=8000)
    print("step:", pg.locator(".prompt-label").inner_text())
    assert pg.get_by_role("button", name="🔊 Я").count() == 1, "нет кнопки своей записи"
    pg.get_by_role("button", name="🔊 Я").click(); pg.wait_for_timeout(200)
    src = pg.evaluate("window.__plays[window.__plays.length-1]")
    assert src.startswith("blob:"), f"своя запись не blob: {src}"
    pg.screenshot(path=f"{OUT}/echo-compare.png")
    pg.get_by_role("button", name="Записать ещё раз").click()
    pg.locator(".prompt-label", has_text="запись").wait_for(timeout=8000); pg.wait_for_timeout(300)
    pg.get_by_role("button", name="Стоп").click()
    pg.locator(".prompt-label", has_text="сравни").wait_for(timeout=8000)
    print("take label:", pg.get_by_role("button", name="🔊 Я · дубль 2").count())
    assert pg.get_by_role("button", name="🔊 Я · дубль 2").count() == 1
    pg.get_by_role("button", name="Дальше").click(); pg.wait_for_timeout(400)
    print("next:", pg.locator(".review-head").inner_text().replace("\n", " "), "|", pg.locator(".prompt-label").inner_text())
    assert "2 из" in pg.locator(".review-head").inner_text()
    # Выход во время записи: рекордер и дорожки гасятся, ошибок нет
    pg.get_by_role("button", name="Записать себя").click()
    pg.locator(".prompt-label", has_text="запись").wait_for(timeout=8000)
    pg.get_by_role("button", name="Выйти").click(); pg.wait_for_timeout(500)
    assert pg.locator(".review-menu").count() == 1, "после «Выйти» не вернулись в меню"
    print("uploads during session:", uploads)
    assert uploads == [], "со страницы ушёл запрос с телом"
    print("pageerrors (mic):", errors)
    assert errors == []
    b.close()

    # 2. Микрофон запрещён: остаёмся в «слушай», записи нет, «Дальше» работает
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 420, "height": 860})
    pg = ctx.new_page(); pg.add_init_script(FAKE_AUDIO); errors = []
    # Реальный отказ пользователя: NotAllowedError — микрофон выключается на весь подход
    pg.add_init_script("navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));")
    pg.on("pageerror", lambda e: errors.append(str(e)))
    open_echo(pg)
    pg.get_by_role("button", name="Записать себя").click()
    pg.locator(".listen-hint").wait_for(timeout=8000)
    note = pg.locator(".listen-hint").inner_text()
    print("denied note:", note, "| step:", pg.locator(".prompt-label").inner_text())
    assert "Микрофон недоступен" in note
    assert pg.get_by_role("button", name="Записать себя").count() == 0
    pg.get_by_role("button", name="Дальше").click(); pg.wait_for_timeout(300)
    assert "2 из" in pg.locator(".review-head").inner_text()
    pg.screenshot(path=f"{OUT}/echo-nomic.png")
    print("pageerrors (denied):", errors)
    b.close()
print("ECHO QA OK")
