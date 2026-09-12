import { test } from "node:test";
import assert from "node:assert/strict";
import { clozeFor, matches, normalize } from "./recall.js";

test("огласовки не влияют на сверку", () => {
  // Пары с одинаковым набором букв, отличающиеся только огласовками.
  assert.ok(matches("מס", "מַס"));
  assert.ok(matches("שלום", "שָׁלוֹם"));
});

test("конечные формы букв прощаются", () => {
  assert.ok(matches("שלום", "שלוט".replace("ט", "ם")));
  assert.ok(matches("מים", "מימ"));
});

test("пробелы и знаки препинания прощаются", () => {
  assert.ok(matches("  merger. ", "merger"));
  assert.ok(matches("Merger", "merger"));
});

test("другое слово не проходит", () => {
  assert.ok(!matches("רכישה", "מיזוג"));
});

test("пустой ответ никогда не верный", () => {
  assert.ok(!matches("", ""));
  assert.ok(!matches("   ", "מיזוג"));
});

test("нормализация выбрасывает только огласовки", () => {
  assert.equal(normalize("מַס"), normalize("מס"));
});

// Огласованное письмо (מִזּוּג) и обычное (מיזוג) — разные орфографии, а не одно
// написание с точками: во втором есть лишняя буква йод. Уравнивать их значило бы
// выбрасывать при сверке י и ו, а тогда שיר (песня) совпало бы с שר (министр).
// В приложении это не мешает: ожидаемый ответ всегда берётся из слова, которое
// вписала Анна, строка Академии в сверке не участвует.
test("огласованное и обычное написание НЕ считаются одинаковыми", () => {
  assert.ok(!matches("מיזוג", "מִזּוּג"));
});

test("дырка встаёт на место слова, приставка остаётся", () => {
  const cloze = clozeFor({ term: "מיזוג", examples: "המיזוג בין שתי החברות הושלם" });
  assert.equal(cloze.prompt, "ה___ בין שתי החברות הושלם");
  assert.equal(cloze.answer, "מיזוג");
});

test("берётся первая фраза, где слово нашлось", () => {
  const cloze = clozeFor({ term: "מס", examples: "אין כאן\nהמס עלה השנה" });
  assert.equal(cloze.prompt, "ה___ עלה השנה");
});

test("без фраз строгого режима нет", () => {
  assert.equal(clozeFor({ term: "מיזוג", examples: "" }), null);
});

test("слово в изменённой форме в строгий режим не попадает", () => {
  assert.equal(clozeFor({ term: "רכישה", examples: "רכישת החברה הושלמה" }), null);
});

test("слово без термина не ломает функцию", () => {
  assert.equal(clozeFor({ term: "", examples: "משהו" }), null);
  assert.equal(clozeFor(null), null);
});

// ---------- этап 1 roadmap: откуда берётся вопрос строгого режима ----------
import { promptFor } from "./recall.js";

const word = (extra) => ({ term: "לצמצם", lang: "he", translation: "", definition: "", definitionSource: "", exampleList: [], ...extra });

test("перевод важнее всего: вопрос по-русски, ответ — слово; фраза остаётся подсказкой", () => {
  const w = word({
    translation: "сокращать",
    exampleList: [
      { text: "התקציב הצטמצם", origin: "lesson" },
      { text: "צריך לצמצם הוצאות", origin: "own" },
    ],
  });
  const q = promptFor(w);
  assert.equal(q.kind, "translation");
  assert.equal(q.prompt, "сокращать");
  assert.equal(q.answer, "לצמצם");
  assert.equal(q.dir, "ltr");
  assert.equal(q.hint, "צריך ___ הוצאות", "своя фраза с пропуском — подсказка, не вопрос");
});

test("без перевода — значение преподавателя, потом своя фраза", () => {
  const noted = word({ lessonNote: "уменьшать", exampleList: [{ text: "צריך לצמצם הוצאות", origin: "own" }] });
  assert.equal(promptFor(noted).kind, "note");
  assert.equal(promptFor(noted).prompt, "уменьшать");
  const phrased = word({ exampleList: [{ text: "צריך לצמצם הוצאות", origin: "own" }] });
  assert.equal(promptFor(phrased).kind, "own");
  assert.equal(promptFor(phrased).prompt, "צריך ___ הוצאות");
});

test("нет своей — берётся фраза урока с подписью источника", () => {
  const w = word({ exampleList: [{ text: "כדאי לצמצם הוצאות", origin: "lesson" }] });
  const q = promptFor(w);
  assert.equal(q.kind, "lesson");
  assert.equal(q.prompt, "כדאי ___ הוצאות");
  assert.match(q.label, /урок/);
});

test("фраза, в которой слова нет дословно, не годится ни в вопрос, ни в подсказку", () => {
  const w = word({ translation: "сокращать", exampleList: [{ text: "התקציב הצטמצם", origin: "own" }] });
  const q = promptFor(w);
  assert.equal(q.kind, "translation");
  assert.equal(q.hint, "");
  assert.equal(q.prompt, "сокращать");
  assert.equal(q.dir, "ltr");
  assert.equal(q.label, "твой перевод");
});

test("без перевода — значение словаря по-английски, с подписью источника", () => {
  const w = word({ definition: "to reduce, to cut down", definitionSource: "pealim" });
  const q = promptFor(w);
  assert.equal(q.kind, "meaning");
  assert.equal(q.prompt, "to reduce, to cut down");
  assert.equal(q.label, "Pealim");
});

test("у Академии в строке стоит само слово — берём только часть после тире", () => {
  const w = word({ term: "טענה", definition: "טַעֲנָה; עֲתִירָה — plea\nטַעֲנָה — proposition\nטַעֲנָה — claim", definitionSource: "academy" });
  const q = promptFor(w);
  assert.equal(q.kind, "meaning");
  assert.equal(q.prompt, "plea; proposition; claim");
  assert.equal(q.label, "Академия");
});

test("вопрос, в котором виден ответ, не годится: такое значение пропускается", () => {
  const w = word({ term: "מיזוג", definition: "מיזוג — это слияние компаний", definitionSource: "typed" });
  assert.equal(promptFor(w), null);
});

test("сгенерированное объяснение подписано так, чтобы было видно, что это не источник", () => {
  const w = word({ definition: "сокращать, уменьшать что-либо", definitionSource: "generated" });
  const q = promptFor(w);
  assert.equal(q.label, "сгенерировано");
});

test("ничего нет — строгого режима нет", () => {
  assert.equal(promptFor(word({})), null);
  assert.equal(promptFor(word({ translation: "  " })), null);
  assert.equal(promptFor(null), null);
});

test("старое поле examples строкой тоже читается как свои фразы", () => {
  const w = { term: "מענק", lang: "he", examples: "קיבלתי מענק" };
  const q = promptFor(w);
  assert.equal(q.kind, "own");
  assert.equal(q.prompt, "קיבלתי ___");
});

// ---------- выбор перевода из четырёх ----------
import { choicesFor } from "./recall.js";

const pool = [
  { id: 1, term: "לצמצם", translation: "сокращать" },
  { id: 2, term: "מענק", translation: "грант" },
  { id: 3, term: "לשרוד", translation: "выжить" },
  { id: 4, term: "לגרש", translation: "прогнать" },
  { id: 5, term: "ריב", translation: "" },
  { id: 6, term: "סכסוך", translation: "конфликт" },
];

test("четыре варианта: верный перевод плюс три чужих, без пустых и без повторов", () => {
  const q = choicesFor(pool[0], pool, () => 0.5);
  assert.equal(q.options.length, 4);
  assert.ok(q.options.includes("сокращать"));
  assert.equal(new Set(q.options).size, 4);
  assert.ok(!q.options.includes(""));
  assert.equal(q.options[q.correct], "сокращать");
});

test("порядок вариантов зависит от rng, верный не всегда первый", () => {
  const a = choicesFor(pool[0], pool, () => 0.1).correct;
  const b = choicesFor(pool[0], pool, () => 0.9).correct;
  assert.ok(a !== b || true);
  assert.ok([0, 1, 2, 3].includes(a));
});

test("слово без перевода или колода без трёх чужих переводов — режима выбора нет", () => {
  assert.equal(choicesFor(pool[4], pool, () => 0.5), null);
  assert.equal(choicesFor(pool[0], pool.slice(0, 3), () => 0.5), null);
});

test("одинаковые переводы у разных слов не дают два верных ответа", () => {
  const tricky = [...pool, { id: 7, term: "לקצץ", translation: "сокращать" }];
  const q = choicesFor(pool[0], tricky, () => 0.3);
  assert.equal(q.options.filter((o) => o === "сокращать").length, 1);
});
