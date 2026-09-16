import { test } from "node:test";
import assert from "node:assert/strict";
import { lemmaFor, parseDefinitions, attribution } from "./he-wiktionary.js";

// Толкование на иврите из he.wiktionary.org (CC BY-SA 4.0). Лемма глагола — прошедшее 3 л. ед. м. из Pealim;
// не глагол — сам термин без предлога. Берём первые два определения, шаблоны и ссылки вычищаем.

test("лемма: глагол по PERF-3ms, иначе термин без служебного предлога", () => {
  assert.equal(lemmaFor({ term: "להפר", forms: JSON.stringify({ "PERF-3ms": { bare: "הפר" } }) }), "הפר");
  assert.equal(lemmaFor({ term: "דממה", forms: "" }), "דממה");
  assert.equal(lemmaFor({ term: "להסתכסך עם", forms: "{}" }), "להסתכסך");
  assert.equal(lemmaFor({ term: "", forms: "" }), "");
});

test("определения: строки «#», без шаблонов и ссылок, максимум две, примеры «#:» пропускаются", () => {
  const wikitext = `== עברית ==
{{ניתוח דקדוקי|כתיב מלא=צמצם}}
# [[הקטין]] או [[הפחית]] ככל האפשר את הכמות, המספר, הגודל או הנפח של דבר מה.
#: ''המפעל '''צמצם''' את הייצור.''
# {{רובד|חז"ל}} דחק, [[כיווץ|כיווץ]].
# שלישי, лишний.
==== גיזרון ====`;
  assert.deepEqual(parseDefinitions(wikitext), ["הקטין או הפחית ככל האפשר את הכמות, המספר, הגודל או הנפח של דבר מה.", "דחק, כיווץ."]);
});

test("определений нет или статья пустая — null", () => {
  assert.equal(parseDefinitions("== עברית ==\n{{שורש}}\n"), null);
  assert.equal(parseDefinitions(""), null);
  assert.equal(parseDefinitions(null), null);
});

test("атрибуция: подпись со ссылкой и лицензией", () => {
  const a = attribution("צמצם");
  assert.match(a.label, /Викисловарь/);
  assert.match(a.label, /CC BY-SA/);
  assert.equal(a.url, "https://he.wiktionary.org/wiki/%D7%A6%D7%9E%D7%A6%D7%9D");
});
