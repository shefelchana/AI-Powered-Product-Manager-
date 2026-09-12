// Формы глагола — из таблицы Pealim, никогда не вычисляются.
// Фикстура — сохранённая страница /dict/1877-lehakim/ (12.09.2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseConjugation, FORM_LABELS } from "./conjugation.js";

const html = fs.readFileSync(new URL("./fixtures/pealim-lehakim.html", import.meta.url), "utf8");

test("из страницы вынимаются формы по устойчивым идентификаторам, с огласовками и без", () => {
  const forms = parseConjugation(html);
  assert.equal(forms["INF-L"].vocalized, "לְהָקִים");
  assert.equal(forms["INF-L"].bare, "להקים");
  assert.equal(forms["AP-fs"].bare, "מקימה");
  assert.equal(forms["PERF-3ms"].bare, "הקים");
  assert.equal(forms["PERF-1s"].bare, "הקמתי");
  assert.equal(forms["IMPF-3ms"].bare, "יקים");
  assert.equal(forms["IMP-2ms"].bare, "הקם", "восклицательный знак и метка направления не часть формы");
});

test("покрыты все формы, которые нужны упражнениям: настоящее ×4, прошедшее и будущее по лицам", () => {
  const forms = parseConjugation(html);
  for (const id of Object.keys(FORM_LABELS)) {
    assert.ok(forms[id], `нет формы ${id}`);
  }
});

test("каждая форма подписана словами: лицо, род, число, время", () => {
  assert.equal(FORM_LABELS["PERF-3fs"].ru, "она (прошедшее)");
  assert.equal(FORM_LABELS["AP-mp"].ru, "мы/вы/они, м. р. (настоящее)");
  assert.equal(FORM_LABELS["IMPF-1p"].ru, "мы (будущее)");
  assert.equal(FORM_LABELS["PERF-3fs"].pronoun, "היא");
});

test("страница без таблицы — пустой объект, не исключение", () => {
  assert.deepEqual(parseConjugation("<html><body>nothing</body></html>"), {});
  assert.deepEqual(parseConjugation(""), {});
});
