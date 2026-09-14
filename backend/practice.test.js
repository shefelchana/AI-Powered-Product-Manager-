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

test("вопрос никогда не на иврите: строка Академии режется до английской части, утечка ответа — пропуск", () => {
  const academy = { id: 4, term: "להיות מודע ל", translation: "", lessonNote: "", definition: "מוּדָע — aware\nמוּדָע — conscious", definitionSource: "academy", forms: "" };
  const list = buildExercises([academy], { limit: 3, rng: () => 0 });
  assert.equal(list.length, 1);
  assert.equal(list[0].prompt, "aware; conscious");
  const leaky = { id: 5, term: "להקל על", translation: "", lessonNote: "", definition: "להקל — облегчить", definitionSource: "typed", forms: "" };
  assert.deepEqual(buildExercises([leaky], { limit: 3, rng: () => 0 }), []);
});

test("предложения не вытесняют формы: не больше 60% подхода, остальное — глаголы и предлоги", () => {
  const sentences = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, he: "משפט " + i, ru: "фраза " + i, lessonId: 7, wrongCount: 0 }));
  const list = buildExercises([verb, prep, { ...verb, id: 11 }, { ...prep, id: 12 }], { limit: 10, rng: () => 0.2, sentences });
  assert.equal(list.length, 10);
  assert.equal(list.filter((e) => e.kind === "sentence").length, 6);
  assert.equal(list.filter((e) => e.kind !== "sentence").length, 4);
});

test("если слов мало, предложения добирают подход целиком", () => {
  const sentences = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, he: "משפט " + i, ru: "фраза " + i, lessonId: 7, wrongCount: 0 }));
  const list = buildExercises([verb], { limit: 10, rng: () => 0.2, sentences });
  assert.equal(list.length, 10);
});

// «Мораша»: глагол «поперёк» — одно лицо, все времена подряд, а не одна
// случайная форма. Шаги идут рядом и по порядку: прошедшее → настоящее → будущее.
const fullForms = {
  "INF-L": { vocalized: "לְהָקִים", bare: "להקים" },
  "AP-ms": { vocalized: "מֵקִים", bare: "מקים" },
  "AP-fs": { vocalized: "מְקִימָה", bare: "מקימה" },
  "PERF-3fs": { vocalized: "הֵקִימָה", bare: "הקימה" },
  "IMPF-3fs": { vocalized: "תָּקִים", bare: "תקים" },
  "PERF-3ms": { vocalized: "הֵקִים", bare: "הקים" },
  "IMPF-3ms": { vocalized: "יָקִים", bare: "יקים" },
};
const fullVerb = { ...verb, id: 21, forms: JSON.stringify(fullForms) };

test("поперёк: одно лицо во всех временах, шаги рядом и по порядку времён", () => {
  const list = buildExercises([fullVerb], { limit: 10, rng: () => 0 });
  const cross = list.filter((e) => e.group);
  assert.ok(cross.length >= 3, `ожидали связку из трёх, получили ${cross.length}`);
  assert.ok(cross.every((e) => e.group === cross[0].group && e.wordId === 21));
  assert.deepEqual(cross.map((e) => e.formId), ["PERF-3fs", "AP-fs", "IMPF-3fs"]);
  assert.deepEqual(cross.map((e) => e.step), [1, 2, 3]);
  assert.ok(cross.every((e) => e.steps === 3 && e.person === "она"));
  assert.deepEqual(cross.map((e) => e.label), ["она · прошедшее", "она · настоящее", "она · будущее"]);
});

test("поперёк: формы с промахами тянут к себе лицо", () => {
  const missed = new Map([[21, new Set(["IMPF-3ms"])]]);
  const list = buildExercises([fullVerb], { limit: 10, rng: () => 0, missed });
  assert.equal(list[0].person, "он");
  assert.deepEqual(list.map((e) => e.formId), ["PERF-3ms", "AP-ms", "IMPF-3ms"]);
});

test("поперёк: если у лица одна форма — обычная одиночная форма, без связки", () => {
  const lonely = { ...verb, forms: JSON.stringify({ "AP-fs": forms["AP-fs"], "IMPF-1p": forms["IMPF-1p"] }) };
  const list = buildExercises([lonely], { limit: 10, rng: () => 0.99 });
  assert.equal(list.length, 1);
  assert.equal(list[0].group, undefined);
});

test("лимит режет связку, но не разрывает порядок шагов; подпись «из N» честная", () => {
  const list = buildExercises([fullVerb], { limit: 2, rng: () => 0 });
  assert.deepEqual(list.map((e) => e.formId), ["PERF-3fs", "AP-fs"]);
  assert.deepEqual(list.map((e) => e.steps), [2, 2], "обрезанная связка не обещает третий шаг");
});

// «Мораша»: слух первым. Предложение с аудио преподавателя половину раз
// приходит диктантом: русский текст скрыт, слышишь — пишешь на иврите.
test("диктант: предложение с аудио становится диктантом по rng, без аудио — никогда", () => {
  const withAudio = [{ id: 1, he: "אני רוצה לאכול", heVocalized: "", ru: "я хочу есть", audioUrl: "a.mp3", lessonId: 7, wrongCount: 0 }];
  const dict = buildExercises([], { limit: 5, rng: () => 0.2, sentences: withAudio });
  assert.equal(dict.length, 1);
  assert.equal(dict[0].kind, "dictation");
  assert.equal(dict[0].prompt, "", "вопрос скрыт — только звук");
  assert.equal(dict[0].translation, "я хочу есть");
  assert.equal(dict[0].answer, "אני רוצה לאכול");
  assert.equal(dict[0].audioUrl, "a.mp3");
  assert.equal(dict[0].formId, "dictation");
  const plain = buildExercises([], { limit: 5, rng: () => 0.9, sentences: withAudio });
  assert.equal(plain[0].kind, "sentence");
  const silent = buildExercises([], { limit: 5, rng: () => 0.2, sentences: [{ ...withAudio[0], audioUrl: "" }] });
  assert.equal(silent[0].kind, "sentence");
});

test("диктанты считаются предложениями в квоте 60%", () => {
  const sentences = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, he: "משפט " + i, ru: "фраза " + i, audioUrl: "s.mp3", lessonId: 7, wrongCount: 0 }));
  const list = buildExercises([verb, prep, { ...verb, id: 11 }, { ...prep, id: 12 }], { limit: 10, rng: () => 0.2, sentences });
  assert.equal(list.filter((e) => e.kind === "sentence" || e.kind === "dictation").length, 6);
});
