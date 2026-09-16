import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { classifyDeterministic, wordDiff, validateMiss, sanitize, buildMissPrompt, weeklyFacts, buildWeeklyPrompt, validateWeekly, collectMisses, askGemini, MISS_SCHEMA } from "./tutor.js";

const FIX = JSON.parse(fs.readFileSync(new URL("./fixtures/tutor-misses.json", import.meta.url), "utf-8")).items;
const by = (id) => FIX.find((x) => x.id === id);

test("разница по словам: пара, лишнее, пропущенное", () => {
  assert.deepEqual(wordDiff("הוא צמצם וזה הצטמצם", "הוא צמצם את זה וזה הצטמצם"), { pairs: [], extra: [], missing: ["את", "זה"] });
  assert.deepEqual(wordDiff("זה ההניק משמעות", "זה העניק משמעות").pairs, [["ההניק", "העניק"]]);
  assert.deepEqual(wordDiff("נראה לי שאני לא הענקתי", "נראה לי שלא הענקתי").extra.length + wordDiff("נראה לי שאני לא הענקתי", "נראה לי שלא הענקתי").pairs.length, 2);
});

test("правило: похожие буквы и перестановка — без модели", () => {
  for (const id of [1, 2, 6, 12, 13, 19, 15]) {   // ט/ת, ה/ע, ה/ע, א/ע (омофоны); ר/ד, ג/ד (похожие); перестановка
    const r = classifyDeterministic(by(id));
    assert.ok(r && r.type === "spelling" && r.source === "rule", `#${id}: ${JSON.stringify(r)}`);
    assert.ok(by(id).expectedTypes.includes(r.type));
  }
});

test("правило: артикль после предлога и перед словом", () => {
  for (const id of [4, 24]) {           // חדשים/החדשים, התבגרות/ההתבגרות
    const r = classifyDeterministic(by(id));
    assert.ok(r && r.type === "article", `#${id}: ${JSON.stringify(r)}`);
  }
});

test("правило: только род говорящей — не ошибка; род + предлог — правилу не по силам (null → модель)", () => {
  const r = classifyDeterministic({ given: "אני חושבת שכדאי", expected: "אני חושב שכדאי" });
  assert.equal(r.verdict, "not_an_error");
  const prep = classifyDeterministic(by(10));          // חושבת (не ошибка) + איתו/אותו — предлог, не опечатка
  assert.equal(prep.type, "preposition"); assert.equal(prep.about, "אותו");
  assert.equal(classifyDeterministic(by(18)), null);   // биньян — модели
  assert.equal(classifyDeterministic(by(8)), null);    // предлог — модели
});

test("промпт: данные в тегах, угловые скобки из ответа вырезаны, длина ограничена", () => {
  const p = buildMissPrompt({ given: "<script>x</script> " + "א".repeat(500), expected: "היא מפרה את הדממה.", ru: "Она нарушает тишину." });
  assert.ok(p.includes("<expected>היא מפרה את הדממה.</expected>"));
  assert.ok(!p.includes("<script>"));
  assert.ok(p.includes("<given>scriptx/script"));
  assert.ok(p.length < 2500);
  assert.equal(sanitize("a\n\nb   c"), "a b c");
});

test("проверка ответа модели: about не из данных → отказ; длинно → отказ; иврит вместо русского → отказ; норма → ок", () => {
  const miss = by(18); // הסתכסכנו
  assert.equal(validateMiss({ verdict: "explained", type: "binyan", about: "להתפלל", why: "…", tip: "…" }, miss).ok, false);
  assert.equal(validateMiss({ verdict: "explained", type: "binyan", about: "הסתכסכנו", why: "בניין התפעל", tip: "…" }, miss).ok, false);
  assert.equal(validateMiss({ verdict: "explained", type: "wat", about: "הסתכסכנו", why: "x", tip: "y" }, miss).ok, false);
  const ok = validateMiss({ verdict: "explained", type: "binyan", about: "הסתכסכנו", why: "Нужен биньян התפעל: «הסתכסכנו», а не פיעל «סכסכנו». Взаимное действие — התפעל.", tip: "Ссориться друг с другом — всегда התפעל." }, miss);
  assert.equal(ok.ok, true); assert.equal(ok.value.source, "model");
  assert.equal(validateMiss(null, miss).ok, false);
});

test("дайджест: факты из отчёта без домыслов, проверка ответа", () => {
  const facts = weeklyFacts({ stages: { new: 10, learning: 20, holding: 5 }, retention: { asked: 4, correct: 3 }, activeDays: [{ active: true }, { active: false }], hard: [{ term: "להעניק", misses: 3 }], lessons: [{ date: "2026-09-14", holding: 2, total: 5 }] }, { sentences: [{ wrongCount: 1 }, { wrongCount: 0 }] });
  assert.equal(facts.total, 35); assert.equal(facts.activeDays, 1); assert.deepEqual(facts.hard, ["להעניק (3)"]); assert.equal(facts.siteWrong, 1);
  const withSite = weeklyFacts({ stages: {}, site: [{ date: "2026-09-07", pct: 36, answered: 14 }, { date: "2026-09-09", pct: 80, answered: 10 }] });
  assert.deepEqual(withSite.site, [{ date: "2026-09-07", wrongPct: 36, answered: 14 }, { date: "2026-09-09", wrongPct: 80, answered: 10 }]);
  assert.ok(buildWeeklyPrompt(facts).includes('"total":35'));
  assert.equal(validateWeekly({ holding: "Держится 5 слов.", breaking: "Ломается «להעניק».", focus: "Повтори эхо." }).ok, true);
  assert.equal(validateWeekly({ holding: "", breaking: "x", focus: "y" }).ok, false);
  assert.equal(validateWeekly({ holding: "שלום", breaking: "שלום", focus: "שלום" }).ok, false);
});

test("сбор промахов: только с текстом ответа, эталон — форма по formId, новые сверху, лимит", () => {
  const words = [{ id: 1, term: "להפר", translation: "нарушить", forms: JSON.stringify({ "AP-fs": { bare: "מפרה" } }) }];
  const misses = collectMisses({
    practiceAttempts: [{ wordId: 1, formId: "AP-fs", ok: false, given: "מהפרה", createdAt: "2026-09-15T10:00:00Z" }, { wordId: 1, formId: "AP-fs", ok: false, given: "", createdAt: "2026-09-16T10:00:00Z" }],
    reviewAttempts: [{ wordId: 1, known: false, given: "להפיר", createdAt: "2026-09-16T09:00:00Z" }],
    sentences: [{ id: 5, he: "היא מפרה את הדממה.", ru: "…", myAnswer: "היא מהפרה את הדממה", siteMistakes: "מפרה", updatedAt: "2026-09-14T10:00:00Z" }],
    words, limit: 2,
  });
  assert.equal(misses.length, 2);
  assert.deepEqual(misses.map((m) => m.given), ["להפיר", "מהפרה"]);
  assert.equal(misses[1].expected, "מפרה");
});

test("вызов модели: без ключа — понятная ошибка; ответ разбирается как JSON; 429 — квота", async () => {
  await assert.rejects(askGemini({ prompt: "x", schema: MISS_SCHEMA, key: "" }), /GEMINI_API_KEY/);
  const fake = async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] }) });
  assert.deepEqual(await askGemini({ prompt: "x", schema: MISS_SCHEMA, key: "k", fetchImpl: fake }), { a: 1 });
  await assert.rejects(askGemini({ prompt: "x", schema: MISS_SCHEMA, key: "k", fetchImpl: async () => ({ ok: false, status: 429 }) }), /Квота/);
});

// Из ревью 16.09: правила не должны срабатывать там, где это не их случай.
test("род говорящей — только в первом лице; «он/она» + окончание — не «не ошибка»", () => {
  assert.equal(classifyDeterministic({ given: "הוא אמרה שלום", expected: "הוא אמר שלום" }), null);
  assert.equal(classifyDeterministic({ given: "כתבת מכתב", expected: "כתב מכתב" }), null);
  assert.equal(classifyDeterministic({ given: "אני שוקלת לעזוב", expected: "אני שוקל לעזוב" }).verdict, "not_an_error");
});

test("артикль: приставка глагола — не артикль; слитый с предлогом — артикль", () => {
  assert.equal(classifyDeterministic({ given: "הוא תחיל לעבוד", expected: "הוא התחיל לעבוד" }), null);
  assert.equal(classifyDeterministic({ given: "ענקתי לו זמן", expected: "הענקתי לו זמן" }), null);
  assert.equal(classifyDeterministic({ given: "אחת משותפות", expected: "אחת מהשותפות" }).type, "article");
  assert.equal(classifyDeterministic({ given: "למורים חדשים", expected: "למורים החדשים" }).type, "article");
});

test("омофоны в начале слова и местоимения — не опечатка", () => {
  assert.equal(classifyDeterministic({ given: "וילדים באו", expected: "בילדים באו" }), null);
  assert.equal(classifyDeterministic({ given: "הסביר לי", expected: "אסביר לי" }), null);
  assert.equal(classifyDeterministic({ given: "היא בא", expected: "הוא בא" }).type, "agreement");
  assert.equal(classifyDeterministic({ given: "נתן לי", expected: "נתן לו" }), null);
});

test("about должен совпадать с целым словом из данных, не с фрагментом", () => {
  const miss = { given: "זה ההניק משמעות", expected: "זה העניק משמעות" };
  const base = { verdict: "explained", type: "spelling", why: "Буквы ה и ע звучат одинаково, но пишутся по-разному.", tip: "Запомни корень ע-נ-ק." };
  assert.equal(validateMiss({ ...base, about: "עניק" }, miss).ok, false);
  assert.equal(validateMiss({ ...base, about: "ה" }, miss).ok, false);
  assert.equal(validateMiss({ ...base, about: "העניק" }, miss).ok, true);
  assert.equal(validateMiss({ ...base, about: "ההניק העניק" }, miss).ok, true);
});
