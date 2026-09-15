import { test } from "node:test";
import assert from "node:assert/strict";
import { todayStep, LESSON_WEEKDAYS, ACTIONS, plural } from "./plan.js";

// «Неделя одного урока»: экран дня показывает один шаг на сегодня.
// Уроки по пн и ср. Отсчёт — дни после последнего урока; накануне урока — «Повторить урок».
const L = "2026-09-14"; // понедельник

test("уроки по понедельникам и средам", () => {
  assert.deepEqual(LESSON_WEEKDAYS, [1, 3]);
});

test("просроченные слова — первым делом повторение, план — строкой «потом»", () => {
  const s = todayStep({ dueCount: 4, lessonDate: L, today: "2026-09-14", lessonWords: 3 });
  assert.equal(s.action, "reviewmenu");
  assert.match(s.title, /4 слова/);
  assert.equal(s.then.action, "echo");
});

test("день урока — «Эхо»", () => {
  const s = todayStep({ dueCount: 0, lessonDate: L, today: "2026-09-14", lessonWords: 3 });
  assert.equal(s.action, "echo");
  assert.equal(s.then, null);
});

test("накануне урока — повторить урок, если у урока есть слова; иначе — «Фразы»", () => {
  assert.equal(todayStep({ dueCount: 0, lessonDate: L, today: "2026-09-15", lessonWords: 3 }).action, "prep");   // вторник, завтра среда
  assert.equal(todayStep({ dueCount: 0, lessonDate: L, today: "2026-09-15", lessonWords: 0 }).action, "practice");
  assert.equal(todayStep({ dueCount: 0, lessonDate: "2026-09-16", today: "2026-09-20", lessonWords: 3 }).action, "prep"); // воскресенье → понедельник
});

test("между уроками чередуются «Фразы» и «Эхо»", () => {
  const W = "2026-09-16";
  assert.equal(todayStep({ dueCount: 0, lessonDate: W, today: "2026-09-17", lessonWords: 3 }).action, "practice"); // четверг, день 1
  assert.equal(todayStep({ dueCount: 0, lessonDate: W, today: "2026-09-18", lessonWords: 3 }).action, "echo");     // пятница, день 2
  assert.equal(todayStep({ dueCount: 0, lessonDate: W, today: "2026-09-19", lessonWords: 3 }).action, "practice"); // суббота, день 3
});

test("перерыв дольше недели (праздники) — накануне пн/ср не считаем, что завтра урок", () => {
  const s = todayStep({ dueCount: 0, lessonDate: "2026-09-16", today: "2026-09-29", lessonWords: 3 }); // вторник через 13 дней
  assert.notEqual(s.action, "prep");
  assert.ok(["practice", "echo"].includes(s.action));
});

test("уроков ещё нет, дата в будущем или мусор — «Фразы», без падения", () => {
  assert.equal(todayStep({ dueCount: 0, lessonDate: null, today: "2026-09-15" }).action, "practice");
  assert.equal(todayStep({ dueCount: 0, lessonDate: "2026-12-01", today: "2026-09-15" }).action, "practice");
  assert.equal(todayStep({ dueCount: 0, lessonDate: 42, today: "2026-09-15" }).action, "practice");
  assert.equal(todayStep().action, "practice");
});

test("дата урока со временем (ISO datetime) читается как день", () => {
  assert.equal(todayStep({ dueCount: 0, lessonDate: "2026-09-14T09:00:00.000Z", today: "2026-09-14", lessonWords: 3 }).action, "echo");
});

test("у каждого шага есть заголовок, подсказка, короткое имя, кнопка и допустимое действие", () => {
  for (const today of ["2026-09-14", "2026-09-15", "2026-09-17", "2026-09-18"]) {
    for (const dueCount of [0, 3]) {
      const s = todayStep({ dueCount, lessonDate: L, today, lessonWords: 3 });
      assert.ok(s.title.length > 3 && s.hint.length > 5 && s.short.length > 2 && s.button.length > 3, today);
      assert.ok(ACTIONS.includes(s.action), s.action);
      if (s.then) assert.ok(ACTIONS.includes(s.then.action));
    }
  }
});

test("склонение «слово»", () => {
  assert.equal(plural(1), "слово"); assert.equal(plural(2), "слова"); assert.equal(plural(5), "слов");
  assert.equal(plural(11), "слов"); assert.equal(plural(21), "слово"); assert.equal(plural(104), "слова"); assert.equal(plural(112), "слов");
});
