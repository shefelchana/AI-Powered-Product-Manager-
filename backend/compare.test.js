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
