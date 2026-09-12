// Расписание повторений — чистые функции, гоняются без базы.
import { test } from "node:test";
import assert from "node:assert/strict";
import { answer, INTERVALS, LAST_BOX, dayOffsetFrom, localToday } from "./schedule.js";

const on = (iso) => new Date(iso + "T12:00:00+03:00");

test("лестница: 0, 1, 3, 7, 16 дней — первое повторение в тот же день", () => {
  assert.deepEqual(INTERVALS, { 1: 0, 2: 1, 3: 3, 4: 7, 5: 16 });
  assert.equal(LAST_BOX, 5);
});

test("«знаю» поднимает на коробку выше и назначает срок по лестнице", () => {
  const w = answer({ box: 1 }, true, on("2026-09-12"));
  assert.deepEqual(w, { box: 2, nextDue: "2026-09-13" });
  assert.deepEqual(answer({ box: 3 }, true, on("2026-09-12")), { box: 4, nextDue: "2026-09-19" });
});

test("выученное слово (коробка 5) остаётся в пятой и возвращается через 16 дней", () => {
  assert.deepEqual(answer({ box: 5 }, true, on("2026-09-12")), { box: 5, nextDue: "2026-09-28" });
});

test("«не знаю» возвращает в первую коробку со сроком сегодня, с любой высоты", () => {
  assert.deepEqual(answer({ box: 5 }, false, on("2026-09-12")), { box: 1, nextDue: "2026-09-12" });
  assert.deepEqual(answer({ box: 1 }, false, on("2026-09-12")), { box: 1, nextDue: "2026-09-12" });
});

test("день считается по Израилю, а не по UTC: в 01:00 ночи ещё вчера по UTC, но уже сегодня у нас", () => {
  const night = new Date("2026-09-13T01:00:00+03:00"); // 2026-09-12T22:00Z
  assert.equal(localToday(night), "2026-09-13");
  assert.equal(dayOffsetFrom(night, 1), "2026-09-14");
  assert.equal(localToday(new Date("2026-09-12T23:30:00+03:00")), "2026-09-12");
});

test("испорченная коробка (0, 9, строка) лечится, а не ломает расписание", () => {
  // Коробка 0 лечится в 1, и «знаю» ведёт во вторую — как у любого нового слова.
  assert.equal(answer({ box: 0 }, true, on("2026-09-12")).box, 2);
  assert.equal(answer({ box: 9 }, true, on("2026-09-12")).box, 5);
  assert.equal(answer({ box: "2" }, true, on("2026-09-12")).box, 3);
});
