// Упражнения «как на уроке»: формы глагола и предлог с местоимением.
// Чистая сборка из слов, у которых есть таблица форм или предлог в конце.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildExercises, PREPOSITIONS, prepositionOf } from "./practice.js";

const forms = {
  "INF-L": { vocalized: "לְהָקִים", bare: "להקים" },
  "AP-fs": { vocalized: "מְקִימָה", bare: "מקימה" },
  "PERF-3fs": { vocalized: "הֵקִימָה", bare: "הקימה" },
  "IMPF-1p": { vocalized: "נָקִים", bare: "נקים" },
};
const verb = { id: 1, term: "להקים", translation: "основать", lessonNote: "", forms: JSON.stringify(forms), lessonId: 7 };
const prep = { id: 2, term: "להקל על", translation: "облегчить", forms: "", lessonId: 7 };
const plain = { id: 3, term: "מענק", translation: "грант", forms: "", lessonId: 7 };

test("глагол с формами даёт упражнения на формы: вопрос — перевод и подпись формы, ответ — форма", () => {
  const list = buildExercises([verb], { limit: 10, rng: () => 0 });
  assert.ok(list.length > 0);
  const ex = list[0];
  assert.equal(ex.kind, "form");
  assert.equal(ex.wordId, 1);
  assert.equal(ex.prompt, "основать");
  assert.ok(ex.formId in forms && ex.formId !== "INF-L", "инфинитив не спрашиваем");
  assert.equal(ex.answer, forms[ex.formId].bare);
  assert.equal(ex.answerVocalized, forms[ex.formId].vocalized);
  assert.match(ex.label, /прошедшее|настоящее|будущее/);
});

test("словосочетание с предлогом даёт упражнение на предлог с местоимением", () => {
  assert.equal(prepositionOf("להקל על"), "על");
  assert.equal(prepositionOf("לשלוט ב-"), "ב");
  assert.equal(prepositionOf("להסתכסך עם"), "עם");
  assert.equal(prepositionOf("מענק"), null);
  const list = buildExercises([prep], { limit: 5, rng: () => 0.5 });
  assert.ok(list.length > 0);
  const ex = list[0];
  assert.equal(ex.kind, "preposition");
  assert.equal(ex.prompt, "облегчить");
  assert.match(ex.label, /ты|я|он|она|мы|вы|они/);
  assert.ok(ex.answer.startsWith("להקל "), ex.answer);
  assert.ok(PREPOSITIONS["על"].some((p) => ex.answer === `להקל ${p.he}`));
});

test("слово без форм и без предлога упражнений не даёт; лимит соблюдается; порядок по rng", () => {
  assert.deepEqual(buildExercises([plain], { limit: 5, rng: () => 0 }), []);
  const many = buildExercises([verb, prep, verb, prep], { limit: 3, rng: () => 0.1 });
  assert.equal(many.length, 3);
});

test("слова последнего урока идут первыми", () => {
  const older = { ...verb, id: 9, lessonId: 1 };
  const list = buildExercises([older, verb], { limit: 2, rng: () => 0, recentLessonId: 7 });
  assert.equal(list[0].wordId, 1);
});

test("испорченный JSON форм не роняет сборку", () => {
  assert.deepEqual(buildExercises([{ ...verb, forms: "{oops" }], { limit: 3, rng: () => 0 }), []);
});
