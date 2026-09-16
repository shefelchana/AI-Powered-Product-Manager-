"""«Сделай отрицание»: в практике попадается единица negation — иврит справа налево, перевод виден,
ответ сверяется с оригиналом преподавателя. Единица выпадает случайно (40% предложений с «לא»),
поэтому пробуем несколько подходов."""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1]; OUT = sys.argv[2]
FAKE_AUDIO = "class FakeAudio { constructor(s){this.src=s;} play(){ return Promise.resolve(); } pause(){} } window.Audio = FakeAudio;"
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 420, "height": 860})
    pg.add_init_script(FAKE_AUDIO); errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
    found = False
    for attempt in range(6):
        pg.goto(BASE); pg.wait_for_load_state("networkidle")
        pg.get_by_role("button", name="Повторять").first.click(); pg.wait_for_timeout(300)
        pg.get_by_role("button", name="Фразы: формы, предлоги, отрицания").click(); pg.wait_for_timeout(1200)
        for i in range(10):
            if pg.locator(".prompt-label").count() == 0: break
            if "отрицание" in pg.locator(".prompt-label").inner_text(): found = True; break
            if pg.get_by_role("button", name="Не помню").count(): pg.get_by_role("button", name="Не помню").click()
            elif pg.get_by_role("button", name="Не разобрала").count(): pg.get_by_role("button", name="Не разобрала").click()
            else: break
            pg.get_by_role("button", name="Дальше").click(); pg.wait_for_timeout(150)
        if found: break
    assert found, "единица «отрицание» не встретилась за 6 подходов"
    cloze = pg.locator(".cloze")
    print("prompt:", cloze.inner_text(), "| dir:", cloze.get_attribute("dir"))
    assert cloze.get_attribute("dir") == "rtl"
    assert "לא" not in cloze.inner_text().split() and "אין" not in cloze.inner_text().split()
    assert pg.locator("textarea").count() == 1
    pg.screenshot(path=f"{OUT}/negation-prompt.png")
    # правильный ответ: вставим «לא» перед вторым словом — не обязательно верно, проверяем только вердикт и показ эталона
    pg.locator("textarea").fill("שלום")
    pg.get_by_role("button", name="Проверить").click(); pg.wait_for_timeout(300)
    verdict = pg.locator(".verdict").inner_text()
    print("verdict:", verdict[:140].replace("\n", " / "))
    assert "לא" in verdict or "אין" in verdict, "эталон с отрицанием не показан"
    pg.screenshot(path=f"{OUT}/negation-verdict.png")
    print("pageerrors:", errors); assert errors == []
    b.close()
print("NEGATION QA OK")
