// Отчёт о прогрессе — чистая функция над словами и журналом ответов.
import { test } from "node:test";
import assert from "node:assert/strict";
import { progressReport, STAGE_NAMES } from "./progress.js";

const d = (s) => new Date(s + "T10:00:00+03:00");
const words = [
  { id: 1, term: "לצמצם", translation: "сокращать", box: 5, misses: 0, lessonId: 1 },
  { id: 2, term: "מענק", translation: "грант", box: 5, misses: 1, lessonId: 1 },
  { id: 3, term: "ריב", translation: "ссора", box: 1, misses: 4, lessonId: 2 },
  { id: 4, term: "לשרוד", translation: "выжить", box: 3, misses: 2, lessonId: null },
];
const attempts = [
  { wordId: 1, known: true, boxBefore: 5, boxAfter: 5, createdAt: d("2026-09-10") }, // вспомнила через 16 дней → выучено
  { wordId: 2, known: true, boxBefore: 4, boxAfter: 5, createdAt: d("2026-09-11") }, // дошла до 5, но 16-дневного ещё не было
  { wordId: 3, known: false, boxBefore: 4, boxAfter: 1, createdAt: d("2026-09-11") }, // вернулось после недели и забылось
  { wordId: 3, known: false, boxBefore: 1, boxAfter: 1, createdAt: d("2026-09-12") },
  { wordId: 4, known: true, boxBefore: 2, boxAfter: 3, createdAt: d("2026-09-12") },
];
const lessons = [{ id: 1, date: "2026-09-07", title: "Домашняя работа 07.09" }, { id: 2, date: "2026-09-09", title: "Классная 09.09" }];

test("стадии: пятая коробка делится на «закрепляется» и «выучено» (вспомнила через 16 дней)", () => {
  const r = progressReport(words, attempts, lessons, [], d("2026-09-12"));
  assert.deepEqual(r.stages, { new: 1, day1: 0, day3: 1, week: 0, settling: 1, learned: 1 });
  assert.equal(STAGE_NAMES.settling, "закрепляется");
  assert.equal(r.learnedIds.includes(1), true);
  assert.equal(r.learnedIds.includes(2), false);
});

test("удержание: только ответы на словах, вернувшихся после недели и дольше (коробка до ответа ≥ 4)", () => {
  const r = progressReport(words, attempts, lessons, [], d("2026-09-12"));
  // словам 1, 2 и 3 отвечали, когда они стояли в коробке 4–5: три ответа, два верных
  assert.deepEqual(r.retention, { asked: 3, correct: 2 });
});

// Один промах у нового слова — норма, а не сигнал. «Не держится» — от двух.
test("что не держится: слова с двумя и более промахами, по убыванию", () => {
  const r = progressReport(words, attempts, lessons, [], d("2026-09-12"));
  assert.deepEqual(r.hard.map((h) => h.term), ["ריב", "לשרוד"]);
});

test("по урокам: сколько слов держится (коробка ≥ 3) и сколько выучено", () => {
  const r = progressReport(words, attempts, lessons, [], d("2026-09-12"));
  assert.deepEqual(r.lessons[0], { id: 1, title: "Домашняя работа 07.09", date: "2026-09-07", total: 2, holding: 2, learned: 1 });
  assert.deepEqual(r.lessons[1], { id: 2, title: "Классная 09.09", date: "2026-09-09", total: 1, holding: 0, learned: 0 });
});

test("активность: дни с ответами за последние 14 дней, без стриков", () => {
  const r = progressReport(words, attempts, lessons, [], d("2026-09-12"));
  assert.equal(r.activeDays.length, 14);
  assert.deepEqual(r.activeDays.slice(-3), [{ date: "2026-09-10", active: true }, { date: "2026-09-11", active: true }, { date: "2026-09-12", active: true }]);
  assert.equal(r.activeDays[0].active, false);
});

test("практика форм: точность по форме, только там, где были попытки", () => {
  const practice = [{ formId: "PERF-3fs", ok: true }, { formId: "PERF-3fs", ok: false }, { formId: "על:ты (ж.)", ok: false }];
  const r = progressReport(words, attempts, lessons, practice, d("2026-09-12"));
  assert.deepEqual(r.forms, [{ formId: "PERF-3fs", label: "она (прошедшее)", asked: 2, correct: 1 }, { formId: "על:ты (ж.)", label: "על + ты (ж.)", asked: 1, correct: 0 }]);
});

test("пустая колода не ломает отчёт", () => {
  const r = progressReport([], [], [], [], d("2026-09-12"));
  assert.equal(r.retention.asked, 0); assert.deepEqual(r.hard, []); assert.equal(r.activeDays.length, 14);
});

test("сайт ульпана: доля ошибок по заданиям, только отвеченные, по датам", () => {
  const lessons = [
    { id: 3, date: "2026-09-09", title: "Домашняя работа 09.09 · Hebreway", siteAnswered: 10, siteWrong: 8 },
    { id: 2, date: "2026-09-07", title: "Домашняя работа 07.09 · Hebreway", siteAnswered: 14, siteWrong: 5 },
    { id: 4, date: "2026-09-14", title: "Классная работа 14.09 · Hebreway", siteAnswered: 0, siteWrong: 0 },
  ];
  const r = progressReport([], [], lessons, []);
  assert.deepEqual(r.site.map((s) => [s.date, s.answered, s.wrong, s.pct]), [["2026-09-07", 14, 5, 36], ["2026-09-09", 10, 8, 80]]);
  assert.deepEqual(progressReport([], [], [], []).site, []);
});
