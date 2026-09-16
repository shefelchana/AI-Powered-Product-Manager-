import { test } from "node:test";
import assert from "node:assert/strict";
import { searchWords, partitionWords } from "./words.js";

// Вкладка «Слова»: поиск по термину и переводу (без огласовок, без регистра, по любой части),
// секция «Нужен перевод» отдельно от остальных; порядок — новые сверху.
const W = [
  { id: 1, term: "להפר", translation: "нарушить" },
  { id: 2, term: "דממה", translation: "полное молчание" },
  { id: 3, term: "לטרלל", translation: "" },
  { id: 4, term: "שָׁלוֹם", translation: "мир" },
  { id: 5, term: "להסתכסך עם", translation: "" },
];

test("пустой запрос — все слова", () => {
  assert.equal(searchWords(W, "").length, 5);
  assert.equal(searchWords(W, "   ").length, 5);
});

test("поиск по части термина и по переводу, без регистра", () => {
  assert.deepEqual(searchWords(W, "הפר").map((w) => w.id), [1]);
  assert.deepEqual(searchWords(W, "МОЛЧ").map((w) => w.id), [2]);
  // Подстрока внутри слова тоже находит: «סך» есть в «להסתכסך».
  assert.deepEqual(searchWords(W, "סך").map((w) => w.id), [5]);
  assert.deepEqual(searchWords(W, "нет такого").map((w) => w.id), []);
});

test("огласовки не мешают: «שלום» находит «שָׁלוֹם», и наоборот", () => {
  assert.deepEqual(searchWords(W, "שלום").map((w) => w.id), [4]);
  assert.deepEqual(searchWords(W, "שָׁל").map((w) => w.id), [4]);
});

test("секции: без перевода отдельно, внутри — новые сверху", () => {
  const { needs, rest } = partitionWords(W);
  assert.deepEqual(needs.map((w) => w.id), [5, 3]);
  assert.deepEqual(rest.map((w) => w.id), [4, 2, 1]);
});

test("мусор на входе не роняет", () => {
  assert.deepEqual(searchWords(null, "x"), []);
  assert.deepEqual(partitionWords(undefined), { needs: [], rest: [] });
  assert.equal(searchWords([{ id: 9 }], "a").length, 0);
});
