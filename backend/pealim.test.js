import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBinyan, parseRoot, parseTitle } from "./pealim.js";

test("из заголовка берутся слово и значение", () => {
  const entry = parseTitle("להזדרז – to hurry up, to hustle – Hebrew conjugation tables");
  assert.equal(entry.term, "להזדרז");
  assert.equal(entry.meaning, "to hurry up, to hustle");
});

test("второй реальный заголовок разбирается так же", () => {
  const entry = parseTitle("להדגיש – to emphasise, to stress – Hebrew conjugation tables");
  assert.equal(entry.meaning, "to emphasise, to stress");
});

test("экранированные сущности раскрываются", () => {
  const entry = parseTitle("לומר – to say &quot;yes&quot; – Hebrew conjugation tables");
  assert.equal(entry.meaning, 'to say "yes"');
});

// Дефис вместо длинного тире, одна часть вместо трёх, пустой ввод — всё это
// «данных нет». Частичный объект возвращать нельзя: правдоподобное, но неверное
// значение хуже отсутствия значения.
test("заголовок с обычным дефисом не разбирается", () => {
  assert.equal(parseTitle("להזדרז - to hurry up - Hebrew conjugation tables"), null);
});

test("заголовок без второго тире не разбирается", () => {
  assert.equal(parseTitle("להזדרז – to hurry up"), null);
});

test("пустое значение между тире не считается данными", () => {
  assert.equal(parseTitle("להזדרז –  – Hebrew conjugation tables"), null);
});

test("пустой и отсутствующий ввод не ломают разбор", () => {
  assert.equal(parseTitle(""), null);
  assert.equal(parseTitle(null), null);
});

// Сверку найденного слова с запрошенным тестируем через экспортируемую bare-логику
// косвенно: сам lookupPealim ходит в сеть, поэтому здесь проверяем только разбор.
// Живая проверка на бессмыслице «קשקוש123» зафиксирована в отчёте задачи.

// --- корень и биньян ---
// Разметка живёт в мета-теге: «Verb – HITPA&apos;EL | Root: ז - ר - ז» и сразу
// за корнем, без разделителя, идёт английский текст.

const VERB_META = `<meta content="Verb – HITPA&apos;EL | Root: ז - ר - זThe middle radical of this word is guttural. | Infinitive: לְהִזְדָּרֵז lehizdarez">`;
const NOUN_META = `<meta content="Noun – no binyan | Root: מ - ז - גMerging of companies. | Singular: מִזּוּג mizug">`;

test("биньян читается несмотря на экранированный апостроф", () => {
  assert.equal(parseBinyan(VERB_META), "HITPA'EL");
});

test("у существительного биньян не выдумывается", () => {
  assert.equal(parseBinyan(NOUN_META), "");
});

test("корень берётся до конца последовательности, а не по длине окна", () => {
  assert.equal(parseRoot(VERB_META), "ז־ר־ז");
  assert.equal(parseRoot(NOUN_META), "מ־ז־ג");
});

test("без корня и на мусоре возвращается пустая строка", () => {
  assert.equal(parseRoot("<meta content='ничего'>"), "");
  assert.equal(parseRoot(""), "");
  assert.equal(parseBinyan(null), "");
});
