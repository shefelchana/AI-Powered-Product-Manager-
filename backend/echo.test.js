import { test } from "node:test";
import assert from "node:assert/strict";
import { pickEcho } from "./echo.js";

// «Эхо»: повторение за преподавателем. Берём только предложения с аудио;
// ошибочные на сайте первыми, потом последний урок, потом короткие.
const s = (id, he, extra = {}) => ({ id, he, ru: "перевод", heVocalized: "", audioUrl: `${id}.mp3`, lessonId: 1, wrongCount: 0, ...extra });

test("без аудио — не берём", () => {
  const list = pickEcho([s(1, "שלום"), s(2, "שלום לך", { audioUrl: "" })], { limit: 6 });
  assert.deepEqual(list.map((x) => x.id), [1]);
});

test("ошибочные на сайте идут первыми, затем последний урок, затем короткие", () => {
  const list = pickEcho([
    s(1, "אחת שתיים שלוש ארבע חמש שש", { lessonId: 2 }),
    s(2, "אחת שתיים", { lessonId: 1 }),
    s(3, "אחת שתיים שלוש", { lessonId: 1, wrongCount: 2 }),
    s(4, "אחת", { lessonId: 2 }),
  ], { limit: 6, recentLessonId: 2, rng: () => 0.5 });
  assert.deepEqual(list.map((x) => x.id), [3, 4, 1, 2]);
});

test("лимит соблюдается и наружу уходят только нужные поля", () => {
  const list = pickEcho(Array.from({ length: 10 }, (_, i) => s(i + 1, "מילה " + i)), { limit: 6 });
  assert.equal(list.length, 6);
  assert.deepEqual(Object.keys(list[0]).sort(), ["audioUrl", "he", "heVocalized", "id", "ru", "wrong"]);
});

test("мусор на входе — пустой список, не падение", () => {
  assert.deepEqual(pickEcho(null, {}), []);
  assert.deepEqual(pickEcho([{ he: "", audioUrl: "x" }, null], {}), []);
});

test("больше ошибок на сайте — раньше в очереди", () => {
  const list = pickEcho([s(1, "א", { wrongCount: 1 }), s(2, "ב", { wrongCount: 5 }), s(3, "ג")], { limit: 6 });
  assert.deepEqual(list.map((x) => x.id), [2, 1, 3]);
});
