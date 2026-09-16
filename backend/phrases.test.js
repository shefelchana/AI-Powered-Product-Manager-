import { test } from "node:test";
import assert from "node:assert/strict";
import { containsWord, matchedForm, validatePhrases, buildPhrasesPrompt, acceptedForms, phrasesKey } from "./phrases.js";

const verb = { term: "להפר", translation: "нарушить", forms: JSON.stringify({ "PERF-3fs": { bare: "הפרה" }, "AP-mp": { bare: "מפרים" }, "IMPF-1p": { bare: "נפר" } }) };
const noun = { term: "דממה", translation: "тишина", forms: "" };
const prep = { term: "להסתכסך עם", translation: "поссориться", forms: JSON.stringify({ "PERF-1p": { bare: "הסתכסכנו" } }) };

test("фраза содержит слово дня: форма Pealim, с приставкой, термин с окончанием числа", () => {
  assert.equal(containsWord("היא הפרה את ההסכם.", verb), true);
  assert.equal(containsWord("הם לא מפרים חוקים.", verb), true);
  assert.equal(containsWord("ולהפר את זה אסור.", verb), true);
  assert.equal(containsWord("הוא שבר את הכוס.", verb), false);
  assert.equal(containsWord("ומהדממה הזאת קשה לצאת.", noun), true);      // три приставки подряд
  assert.equal(containsWord("זאת להפרה חמורה.", verb), false);            // «להפרה» — не форма из Pealim
  assert.equal(matchedForm("הם לא מפרים חוקים.", verb), "מפרים");
  assert.equal(containsWord("בלילה יש דממה מוחלטת.", noun), true);
  assert.equal(containsWord("הדממות האלה מפחידות.", noun), true);
  assert.equal(containsWord("הפעם הסתכסכנו.", prep), true);
  // формы хранятся в нормализованном виде (конечные буквы приведены к обычным)
  assert.deepEqual([...acceptedForms(prep).forms].sort(), ["הסתכסכנו", "להסתכסכ"].sort());
});

test("проверка: длинные, без перевода, без слова дня, повторы и кириллица — отбрасываются; остаётся ≤ 3", () => {
  const raw = { phrases: [
    { he: "היא הפרה את ההסכם.", ru: "Она нарушила договор.", form: "она, прошедшее" },
    { he: "היא הפרה את ההסכם!", ru: "повтор", form: "x" },
    { he: "הם מפרים חוקים כל הזמן.", ru: "Они всё время нарушают законы.", form: "они, настоящее" },
    { he: "אנחנו לא נפר את הכללים.", ru: "", form: "мы, будущее" },
    { he: "הוא שבר את הכוס.", ru: "Он разбил стакан.", form: "он" },
    { he: "один два три четыре пять שש שבע שמונה תשע עשר אחד עשר", ru: "…", form: "" },
    { he: "אנחנו לא נפר את הכללים.", ru: "Мы не нарушим правила.", form: "мы, будущее" },
    { he: "עוד פעם היא הפרה.", ru: "Снова она нарушила.", form: "она" },
  ] };
  const v = validatePhrases(raw, verb);
  assert.deepEqual(v.phrases.map((p) => p.he), ["היא הפרה את ההסכם.", "הם מפרים חוקים כל הזמן.", "אנחנו לא נפר את הכללים."]);
  assert.deepEqual(v.phrases.map((p) => p.matched), ["הפרה", "מפרים", "נפר"]);
  assert.ok(v.rejected.some((r) => r.reason === "нет перевода") && v.rejected.some((r) => r.reason === "нет слова дня") && v.rejected.some((r) => r.reason === "повтор"));
  assert.deepEqual(validatePhrases(null, verb).phrases, []);
});

test("промпт: данные в тегах, формы перечислены, угловые скобки вырезаны", () => {
  const p = buildPhrasesPrompt({ ...verb, translation: "<b>нарушить</b>" });
  assert.ok(p.includes("<word>להפר</word>") && p.includes("PERF-3fs: הפרה") && !p.includes("<b>"));
  assert.ok(!buildPhrasesPrompt(noun).includes("\n<forms>"));   // у существительного без форм тега нет (упоминание в инструкции — не тег)
});

test("одна и та же форма дважды — вторая отбрасывается; меньше двух разных форм — блока нет", () => {
  const same = { phrases: [
    { he: "היא הפרה את ההסכם.", ru: "Она нарушила договор.", form: "она" },
    { he: "אתמול היא הפרה חוק.", ru: "Вчера она нарушила закон.", form: "она" },
    { he: "גם אמא הפרה הבטחה.", ru: "Мама тоже нарушила обещание.", form: "она" },
  ] };
  const v = validatePhrases(same, verb);
  assert.deepEqual(v.phrases, []); assert.match(v.note, /разных формах/);
  assert.ok(v.rejected.filter((r) => r.reason === "та же форма").length === 2);
});

test("ключ кэша меняется при смене перевода или форм", () => {
  const a = phrasesKey(verb);
  assert.equal(a, phrasesKey({ ...verb }));
  assert.notEqual(a, phrasesKey({ ...verb, translation: "другой" }));
  assert.notEqual(a, phrasesKey({ ...verb, forms: "{}" }));
});
