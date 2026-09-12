// Расписание повторений (Лейтнер): пять коробок, интервал растёт с коробкой.
// Первое повторение — в тот же день: кривая забывания круче всего в первые
// сутки. Ошибка возвращает слово в первую коробку: лучше повторить лишний
// раз, чем потерять слово через две недели.
export const INTERVALS = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 16 };
export const LAST_BOX = 5;

// День — по часовому поясу Анны, не по UTC сервера: иначе в час ночи
// «сегодняшнее» повторение уезжает на завтра, а срок «сегодня» — на вчера.
export const APP_TZ = process.env.APP_TZ || "Asia/Jerusalem";

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function localToday(now = new Date()) {
  return fmt.format(now);
}

export function dayOffsetFrom(now, days) {
  const [y, m, d] = localToday(now).split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

const clampBox = (box) => Math.min(LAST_BOX, Math.max(1, Number(box) || 1));

// Ответ на повторении: «знаю» — коробка выше, «не знаю» — в первую.
export function answer(word, known, now = new Date()) {
  const box = known ? Math.min(clampBox(word.box) + 1, LAST_BOX) : 1;
  return { box, nextDue: dayOffsetFrom(now, INTERVALS[box]) };
}
