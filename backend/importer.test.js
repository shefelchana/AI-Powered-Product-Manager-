import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTerms } from "./importer.js";

// Импорт текста урока: из вставленного как есть текста вылавливаются
// ивритские слова — кандидаты в колоду. Выбирает человек, поэтому задача
// функции — не потерять слова и не подсунуть мусор, а не угадать нужные.

test("из смешанного текста достаются только ивритские слова, по порядку", () => {
  assert.deepEqual(
    extractTerms("Урок 5: לדבר — говорить, ללכת — идти (стр. 12)"),
    ["לדבר", "ללכת"]
  );
});

test("повторы схлопываются, первое вхождение задаёт порядок", () => {
  assert.deepEqual(extractTerms("שלום עולם שלום"), ["שלום", "עולם"]);
});

test("огласовки не мешают и убираются из кандидата", () => {
  assert.deepEqual(extractTerms("לְדַבֵּר"), ["לדבר"]);
});

test("одиночные буквы — служебный шум, не слова", () => {
  assert.deepEqual(extractTerms("ו החתול ב בית"), ["החתול", "בית"]);
});

test("слово с гершаим (аббревиатура) сохраняется целиком", () => {
  assert.deepEqual(extractTerms('צה"ל'), ['צה"ל']);
});

test("пустой и неивритский текст дают пустой список", () => {
  assert.deepEqual(extractTerms(""), []);
  assert.deepEqual(extractTerms("hello world 123"), []);
  assert.deepEqual(extractTerms(undefined), []);
});
