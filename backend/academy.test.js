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

// --- Кандидаты для человека ---
// Промах поиска — не повод показывать выдачу как есть: для «לכת» (от ללכת)
// там лежат «שיר לכת» (марш) и «לכת ניטרוצלולוזה» (лак) — правдоподобный мусор.
// Предлагаем только совпадающих по написанию без огласовок.
import { offerCandidates } from "./academy.js";

test("составные термины из выдачи не предлагаются", () => {
  const links = [
    { href: "/munnah/34735_1", label: "שיר לכת", display: "שִׁיר לֶכֶת" },
    { href: "/munnah/5157_1", label: "כוכב לכת", display: "כּוֹכַב לֶכֶת" },
    { href: "/munnah/69393_1", label: "לכת ניטרוצלולוזה", display: "לַכַּת ניטרוצלולוזה" },
  ];
  assert.deepEqual(offerCandidates(links, "לכת"), []);
});

test("омографы того же слова предлагаются все", () => {
  const links = [
    { href: "/munnah/18080_1", label: "ספר", display: "סָפַר" },
    { href: "/munnah/28829_1", label: "ספר", display: "סֵפֶר" },
    { href: "/munnah/93633_1", label: "ספר", display: "סִפֵּר" },
  ];
  assert.equal(offerCandidates(links, "ספר").length, 3);
});

test("разница только в матерях чтения не мешает совпадению", () => {
  const links = [{ href: "/munnah/31256_1", label: "דבר", display: "דִּבֵּר" }];
  assert.equal(offerCandidates(links, "דיבר").length, 1);
});
