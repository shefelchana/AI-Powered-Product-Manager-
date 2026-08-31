import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEntry } from "./wiktionary.js";

const NOUN = `== Hebrew ==

=== Noun ===

תַּקְצִיב • (taktsív) m (plural indefinite תַּקְצִיבִים, singular construct תַּקְצִיב־)

A budget.

==== Derived terms ====

תַּקְצִיבִי`;

test("из статьи берутся огласовка, транслитерация, род и значение", () => {
  const entry = parseEntry(NOUN);
  assert.equal(entry.vocalized, "תַּקְצִיב");
  assert.equal(entry.translit, "taktsív");
  assert.equal(entry.gender, "m");
  assert.equal(entry.gloss, "A budget.");
});

test("статьи на иврите нет — возвращается null", () => {
  assert.equal(parseEntry("== Arabic ==\n\n=== Noun ===\n\nكتاب • (kitāb) m\n\nA book."), null);
});

test("пустой и мусорный ввод не ломают разбор", () => {
  assert.equal(parseEntry(""), null);
  assert.equal(parseEntry(null), null);
  assert.equal(parseEntry("== Hebrew ==\n\nбез заголовочной строки"), null);
});

test("раздел другого языка после ивритского не подмешивается", () => {
  const two = `== Hebrew ==

=== Noun ===

רִבִּית • (ribít) f

interest (price of credit)

== Yiddish ==

=== Noun ===

ריבית • (ribes) m

usury`;
  const entry = parseEntry(two);
  assert.equal(entry.translit, "ribít");
  assert.equal(entry.gloss, "interest (price of credit)");
});
