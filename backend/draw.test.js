import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt } from "./draw.js";

test("в запросе есть значение слова", () => {
  const prompt = buildPrompt({ term: "להזדרז", definition: "to hurry up, to hustle" });
  assert.ok(prompt.includes("to hurry up, to hustle"));
});

// Модель не пишет на иврите правильно, а неверная надпись на карточке хуже
// отсутствия надписи — запрет на текст обязан быть в каждом запросе.
test("запрет на надписи стоит всегда", () => {
  for (const word of [
    { term: "מיזוג", definition: "merger" },
    { term: "מיזוג" },
  ]) {
    assert.ok(buildPrompt(word).includes("No text, no letters"));
  }
});

test("перевод используется, когда объяснения нет", () => {
  const prompt = buildPrompt({ term: "ריבית", translation: "interest" });
  assert.ok(prompt.includes("interest"));
});

test("слово без значения не ломает запрос", () => {
  const prompt = buildPrompt({ term: "להזדרז" });
  assert.ok(prompt.length > 0);
  assert.ok(!prompt.includes("It should depict"));
});
