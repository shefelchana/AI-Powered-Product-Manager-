import { test } from "node:test";
import assert from "node:assert/strict";
import { todayStep, LESSON_WEEKDAYS } from "./plan.js";

// «Неделя одного урока»: экран дня показывает один шаг на сегодня.
// Уроки по пн и ср. Отсчёт — дни после последнего урока; накануне урока — «Повторить урок».
const lessons = [{ id: 10, date: "2026-09-14", finishedAt: "x" }, { id: 7, date: "2026-09-09", finishedAt: "x" }];

test("уроки по понедельникам и средам", () => {
  assert.deepEqual(LESSON_WEEKDAYS, [1, 3]);
});

test("просроченные слова — первым делом повторение, план — строкой «потом»", () => {
  const s = todayStep({ dueCount: 4, lessons, today: "2026-09-14", lessonWords: 3 });
  assert.equal(s.action, "reviewmenu");
  assert.match(s.title, /4/);
  assert.equal(s.then.action, "echo");
});

test("день урока — «Эхо»", () => {
  const s = todayStep({ dueCount: 0, lessons, today: "2026-09-14", lessonWords: 3 });
  assert.equal(s.action, "echo");
  assert.equal(s.then, null);
});

test("накануне урока — повторить урок, если у урока есть слова; иначе — «Фразы»", () => {
  assert.equal(todayStep({ dueCount: 0, lessons, today: "2026-09-15", lessonWords: 3 }).action, "prep");   // вторник, завтра среда
  assert.equal(todayStep({ dueCount: 0, lessons, today: "2026-09-15", lessonWords: 0 }).action, "practice");
  assert.equal(todayStep({ dueCount: 0, lessons, today: "2026-09-20", lessonWords: 3 }).action, "prep");   // воскресенье, завтра понедельник
});

test("между уроками чередуются «Фразы» и «Эхо»", () => {
  const wed = [{ id: 11, date: "2026-09-16", finishedAt: "x" }, ...lessons];
  assert.equal(todayStep({ dueCount: 0, lessons: wed, today: "2026-09-17", lessonWords: 3 }).action, "practice"); // четверг, день 1
  assert.equal(todayStep({ dueCount: 0, lessons: wed, today: "2026-09-18", lessonWords: 3 }).action, "echo");     // пятница, день 2
  assert.equal(todayStep({ dueCount: 0, lessons: wed, today: "2026-09-19", lessonWords: 3 }).action, "practice"); // суббота, день 3
});

test("уроков ещё нет или дата в будущем — «Фразы», без падения", () => {
  assert.equal(todayStep({ dueCount: 0, lessons: [], today: "2026-09-15", lessonWords: 0 }).action, "practice");
  assert.equal(todayStep({ dueCount: 0, lessons: [{ id: 1, date: "2026-12-01" }], today: "2026-09-15", lessonWords: 0 }).action, "practice");
  assert.equal(todayStep({ dueCount: 0, lessons: null, today: "2026-09-15" }).action, "practice");
});

test("у каждого шага есть заголовок и подсказка", () => {
  for (const today of ["2026-09-14", "2026-09-15", "2026-09-17", "2026-09-18"]) {
    const s = todayStep({ dueCount: 0, lessons, today, lessonWords: 3 });
    assert.ok(s.title.length > 3 && s.hint.length > 5, today);
  }
});
