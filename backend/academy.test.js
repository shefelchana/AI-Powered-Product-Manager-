import { test } from "node:test";
import assert from "node:assert/strict";
import { isTermPath, searchVariants } from "./academy.js";

test("слово без приставки ищется как есть", () => {
  assert.deepEqual(searchVariants("מס"), ["מס"]);
});

test("приставка ה отрезается вторым вариантом", () => {
  assert.deepEqual(searchVariants("המיזוג"), ["המיזוג", "מיזוג", "יזוג"]);
});

test("две приставки отрезаются по очереди", () => {
  assert.deepEqual(searchVariants("ובחברה"), ["ובחברה", "בחברה", "חברה"]);
});

test("огрызки короче двух букв не пробуем", () => {
  assert.deepEqual(searchVariants("מים"), ["מים"]);
});

test("огласовки в запросе не мешают", () => {
  assert.deepEqual(searchVariants("מַס"), ["מס"]);
});

test("пустой ввод не ломает функцию", () => {
  assert.deepEqual(searchVariants(""), []);
  assert.deepEqual(searchVariants(null), []);
});

test("адрес записи принимается только свой", () => {
  assert.ok(isTermPath("/munnah/29059_1"));
  assert.ok(!isTermPath("/munnah/../../etc/passwd"));
  assert.ok(!isTermPath("https://example.com/munnah/1_1"));
  assert.ok(!isTermPath("/other/29059_1"));
  assert.ok(!isTermPath(undefined));
});
