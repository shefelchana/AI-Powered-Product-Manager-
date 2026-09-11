// backend/compare.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { significantWords, sourcesDisagree } from "./compare.js";

test("значимые слова: латиница от четырёх букв, без служебных", () => {
  assert.deepEqual([...significantWords("A budget for the year")], ["budget", "year"]);
});

test("расхождение: общих значимых слов нет", () => {
  assert.ok(sourcesDisagree("catalyze", "hurry, hasten"));
});

test("совпадение: есть общее значимое слово", () => {
  assert.ok(!sourcesDisagree("merger, amalgamation", "A merger of two companies"));
});

test("один источник промолчал — это не расхождение", () => {
  assert.ok(!sourcesDisagree("", "A budget"));
  assert.ok(!sourcesDisagree("A budget", ""));
});

test("только служебные слова — не расхождение, сравнивать нечем", () => {
  assert.ok(!sourcesDisagree("the and", "A budget"));
});

// --- реальные формы, в которых значения приходят из источников ---
// Тесты выше проверяют упрощённые строки. Ниже — то, что источники отдают на самом деле:
// у Академии определение содержит иврит, длинное тире и несколько эквивалентов,
// а у многозначных слов ещё и несколько строк.

test("иврит и знаки препинания внутри строки не мешают выделить значимые слова", () => {
  assert.deepEqual([...significantWords("מִזּוּג — merger, amalgamation")], ["merger", "amalgamation"]);
});

// Главный случай проекта. У слова לזרז Академия отдаёт термин из словаря
// органической химии, а слово значит «торопить». Ради поимки таких подмен
// правило расхождения и существует.
test("Академия против Pealim по слову לזרז — расхождение", () => {
  assert.ok(sourcesDisagree("קִטְלֵז, זֵרֵז — catalyze", "to hurry up, to hustle"));
});

test("многострочное определение Академии читается целиком, а не первой строкой", () => {
  const academy = "רְכִישָׁה — acquisition, accession\nרְכִישַׁת תְּמוּנָה — image acquisition";
  assert.ok(significantWords(academy).has("image"));
  assert.ok(!sourcesDisagree(academy, "image acquisition of a company"));
});

test("реальные строки, которые сходятся, расхождением не считаются", () => {
  assert.ok(!sourcesDisagree("מִזּוּג — merger, amalgamation", "A merger of two companies"));
});

// --- сравнение по началу слова (находка финального ревью) ---
// Точное совпадение разводило источники на орфографии: метка «спорное»,
// срабатывающая на merger/merging, перестаёт что-либо значить.

test("merger и merging расхождением не считаются", () => {
  assert.ok(!sourcesDisagree("מִזּוּג — merger, amalgamation", "merging"));
});

test("британское и американское написание — не расхождение", () => {
  assert.ok(!sourcesDisagree("to emphasise, to stress", "emphasize"));
});

test("сравнение по началу слова не склеивает разные слова", () => {
  assert.ok(sourcesDisagree("budget, allocation", "hurry, hasten"));
});

// --- Классификация конфликтов ---
// Академия — терминологическая база: её английский эквивалент («speech» из
// словаря психологии 1953 года) законно расходится с переводом глагола
// («to speak»). Такое расхождение — повод посмотреть глазами, а не запрет.
// Блокирует запись только конфликт между словарями значений.
import { conflictReport } from "./compare.js";

test("конфликт со справочным источником — совет, а не запрет", () => {
  const report = conflictReport([
    { name: "Академия", text: "speech", advisory: true },
    { name: "Викисловарь", text: "to speak (say words)" },
    { name: "Pealim", text: "to speak, to talk" },
  ]);
  assert.deepEqual(report.blocking, []);
  assert.deepEqual(report.advisory, ["Академия против Викисловарь", "Академия против Pealim"]);
});

test("конфликт словарей значений блокирует, как раньше", () => {
  const report = conflictReport([
    { name: "Викисловарь", text: "merger, amalgamation" },
    { name: "Pealim", text: "divorce" },
  ]);
  assert.deepEqual(report.blocking, ["Викисловарь против Pealim"]);
  assert.deepEqual(report.advisory, []);
});

test("согласные источники конфликтов не дают", () => {
  const report = conflictReport([
    { name: "Викисловарь", text: "family, kin", advisory: false },
    { name: "Pealim", text: "family" },
  ]);
  assert.deepEqual(report, { blocking: [], advisory: [] });
});
