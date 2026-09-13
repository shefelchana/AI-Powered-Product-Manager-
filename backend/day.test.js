import { test } from "node:test";
import assert from "node:assert/strict";
import { pickWordOfDay, reasonFor, REASONS } from "./day.js";

// Слово дня выбирается по видимому правилу (Анна, 12.09, вариант А):
// не держится → с последнего урока, ещё не повторялось → новое → повторение.
const w = (id, extra = {}) => ({ id, term: `w${id}`, box: 1, misses: 0, lessonId: null, dayPickedAt: null, createdAt: new Date(2026, 8, id), ...extra });

test("сначала то, что не держится: больше всего промахов (от двух)", () => {
  const words = [w(1, { misses: 2 }), w(2, { misses: 4 }), w(3, { misses: 1 })];
  const r = pickWordOfDay(words, { lastLessonId: null, reviewedIds: new Set([1, 2, 3]), today: "2026-09-12" });
  assert.equal(r.word.id, 2);
  assert.equal(r.reason, "не держится: 4 промаха");
});

test("иначе слово последнего урока, которое ещё не повторялось", () => {
  const words = [w(1, { lessonId: 5 }), w(2, { lessonId: 7 }), w(3, { lessonId: 7 })];
  const r = pickWordOfDay(words, { lastLessonId: 7, reviewedIds: new Set([2]), today: "2026-09-12" });
  assert.equal(r.word.id, 3);
  assert.equal(r.reason, REASONS.lesson);
});

test("иначе новое: добавлено, но ни разу не вспоминалось — самое давнее первым", () => {
  const words = [w(1), w(2), w(3, { box: 3 })];
  const r = pickWordOfDay(words, { lastLessonId: null, reviewedIds: new Set([3]), today: "2026-09-12" });
  assert.equal(r.word.id, 1);
  assert.equal(r.reason, REASONS.fresh);
});

test("всё повторялось и держится — повторение из низких коробок, дольше всех не бывшее словом дня", () => {
  const words = [w(1, { box: 2, dayPickedAt: "2026-09-10" }), w(2, { box: 2, dayPickedAt: "2026-09-01" }), w(3, { box: 5 })];
  const r = pickWordOfDay(words, { lastLessonId: null, reviewedIds: new Set([1, 2, 3]), today: "2026-09-12" });
  assert.equal(r.word.id, 2);
  assert.equal(r.reason, REASONS.repeat);
});

test("вчерашнее слово дня не берётся два дня подряд, если есть другие", () => {
  const words = [w(1, { misses: 5, dayPickedAt: "2026-09-11" }), w(2, { misses: 3 })];
  const r = pickWordOfDay(words, { lastLessonId: null, reviewedIds: new Set([1, 2]), today: "2026-09-12" });
  assert.equal(r.word.id, 2);
  const only = pickWordOfDay([words[0]], { lastLessonId: null, reviewedIds: new Set([1]), today: "2026-09-12" });
  assert.equal(only.word.id, 1, "единственное слово всё равно берётся");
});

test("пустая колода — null", () => {
  assert.equal(pickWordOfDay([], { lastLessonId: null, reviewedIds: new Set(), today: "2026-09-12" }), null);
});

test("склонение: 2 промаха, 5 промахов, 21 промах", () => {
  const pick = (n) => pickWordOfDay([w(1, { misses: n })], { lastLessonId: null, reviewedIds: new Set([1]), today: "2026-09-12" }).reason;
  assert.equal(pick(2), "не держится: 2 промаха");
  assert.equal(pick(5), "не держится: 5 промахов");
  assert.equal(pick(21), "не держится: 21 промах");
});

// Слово, выбранное до появления причин (или до деплоя), получает причину задним числом.
test("reasonFor: причина для уже выбранного слова по тому же правилу", () => {
  const ctx = { lastLessonId: 7, reviewedIds: new Set([2]) };
  assert.equal(reasonFor(w(1, { misses: 3 }), ctx), "не держится: 3 промаха");
  assert.equal(reasonFor(w(1, { lessonId: 7 }), ctx), REASONS.lesson);
  assert.equal(reasonFor(w(1, { lessonId: 5 }), ctx), REASONS.fresh);
  assert.equal(reasonFor(w(2, { box: 2 }), ctx), REASONS.repeat);
});
