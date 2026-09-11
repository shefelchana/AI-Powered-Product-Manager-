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

test("несколько частей речи в ивритском разделе — неоднозначность, возвращается null", () => {
  // Слепок в стиле реальной статьи «חנוכה»: Proper noun и Noun — каждая со своей
  // строкой «•» и своим значением. Угадывать нужную часть речи нельзя — правило
  // то же, что и у Академии: несколько вариантов = не выбираем, «нет данных».
  const two = `== Hebrew ==

=== Proper noun ===

חֲנֻכָּה • (khanuká) f

(Judaism) Hanukkah

=== Noun ===

חֲנֻכָּה • (khanuká) f

consecration, dedication, inauguration`;
  assert.equal(parseEntry(two), null);
});

// --- реальный формат статьи (находка финального ревью) ---
// В живых статьях заголовочная строка часто несёт два написания через слэш:
// «ריבית / רִבִּית • (ribít) f». Прежние фикстуры этого не знали.

test("два написания через слэш в заголовочной строке", () => {
  const entry = parseEntry(`== Hebrew ==

=== Noun ===

ריבית / רִבִּית • (ribít) f

interest (price of credit)`);
  assert.equal(entry.vocalized, "ריבית / רִבִּית");
  assert.equal(entry.translit, "ribít");
});

test("несколько значений одной части речи не теряются", () => {
  const entry = parseEntry(`== Hebrew ==

=== Noun ===

מיזוג / מִזּוּג • (mizúg) m

merging

air conditioning

==== Derived terms ====`);
  assert.ok(entry.gloss.includes("merging"));
  assert.ok(entry.gloss.includes("air conditioning"));
});

// --- Стрелки на лемму ---
// «To-infinitive of דיבר (dibér)» — это не значение, а грамматическая ссылка.
// Из неё достаётся лемма (без огласовок — заголовки статей пишутся без них),
// чтобы сходить за настоящим значением.
import { formOfTarget } from "./wiktionary.js";

test("инфинитивная стрелка даёт лемму", () => {
  assert.equal(formOfTarget("To-infinitive of דיבר (dibér)"), "דיבר");
});

test("огласовки в лемме отбрасываются — статья лежит без них", () => {
  assert.equal(formOfTarget("to-infinitive of הָלַךְ (halákh)."), "הלך");
});

test("другие грамматические формы тоже распознаются", () => {
  assert.equal(formOfTarget("Defective spelling of דיבר"), "דיבר");
  assert.equal(formOfTarget("feminine singular of גָּדוֹל"), "גדול");
});

test("обычное значение стрелкой не считается", () => {
  assert.equal(formOfTarget("family (a group of people who are closely related)"), null);
  assert.equal(formOfTarget("to speak, to talk"), null);
});

test("пустой ввод не ломает распознавание", () => {
  assert.equal(formOfTarget(""), null);
  assert.equal(formOfTarget(undefined), null);
});
