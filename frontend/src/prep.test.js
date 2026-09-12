import { test } from "node:test";
import assert from "node:assert/strict";
import { lessonSummary } from "./prep.js";

// Накануне урока: слова прошлого урока целиком и список «?», чтобы спросить.
const lessons = [
  { id: 2, date: "2026-09-14", finishedAt: null },
  { id: 1, date: "2026-09-07", finishedAt: "2026-09-07T10:00:00Z" },
];
const words = [
  { id: 1, term: "לצמצם", lessonId: 1, question: false, box: 2 },
  { id: 2, term: "מענק", lessonId: 1, question: true, box: 1 },
  { id: 3, term: "ריב", lessonId: null, question: true, box: 1 },
  { id: 4, term: "להעניק", lessonId: 2, question: false, box: 1 },
];

test("берётся последний законченный урок, не тот, что идёт сейчас", () => {
  const s = lessonSummary(words, lessons);
  assert.equal(s.lesson.id, 1);
  assert.deepEqual(s.words.map((w) => w.term), ["לצמצם", "מענק"]);
});

test("список «?» — по всей колоде, не только по уроку: вопрос остаётся вопросом", () => {
  const s = lessonSummary(words, lessons);
  assert.deepEqual(s.questions.map((w) => w.term), ["מענק", "ריב"]);
});

test("нет законченных уроков — берётся последний любой; нет уроков — null", () => {
  const s = lessonSummary(words, [{ id: 5, date: "2026-09-20", finishedAt: null }]);
  assert.equal(s.lesson.id, 5);
  assert.equal(lessonSummary(words, []).lesson, null);
  assert.deepEqual(lessonSummary(words, []).words, []);
  assert.equal(lessonSummary([], []).questions.length, 0);
});
