import { test } from "node:test";
import assert from "node:assert/strict";
import { lemmaFor, parseDefinitions, attribution, lookupHeWiktionary } from "./he-wiktionary.js";

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

test("поиск: нет статьи → null; есть → текст с нумерацией, подпись и ссылка; HTTP-ошибка → исключение", async () => {
  const ok = { ok: true, status: 200, json: async () => ({ parse: { wikitext: "== עברית ==\n# שקט, דומיה.\n# העדר רוח." } }) };
  const missing = { ok: true, status: 200, json: async () => ({ error: { code: "missingtitle" } }) };
  const found = await lookupHeWiktionary({ term: "דממה", forms: "" }, { fetchImpl: async () => ok });
  assert.equal(found.text, "1. שקט, דומיה.\n2. העדר רוח.");
  assert.equal(found.lemma, "דממה");
  assert.match(found.url, /he\.wiktionary\.org/);
  assert.equal(await lookupHeWiktionary({ term: "להתבגר", forms: "" }, { fetchImpl: async () => missing }), null);
  await assert.rejects(lookupHeWiktionary({ term: "x" }, { fetchImpl: async () => ({ ok: false, status: 503 }) }), /503/);
  assert.equal(await lookupHeWiktionary({ term: "" }, { fetchImpl: async () => ok }), null);
});
