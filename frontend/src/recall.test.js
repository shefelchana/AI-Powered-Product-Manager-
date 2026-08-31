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
