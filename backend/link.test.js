import { test } from "node:test";
import assert from "node:assert/strict";
import { sentencesFor, tokensOf } from "./link.js";

// Фразы урока → к слову. Точность важнее полноты: только целые токены, глагол — по формам Pealim,
// одна приставка (ו/ה/ש/כ/ב/ל/מ) и только если остаток — точная форма длиной ≥ 3.
const forms = { "INF-L": { bare: "להפר" }, "PERF-3ms": { bare: "הפר" }, "AP-fs": { bare: "מפרה" }, "AP-mp": { bare: "מפרים" }, "IMPF-1s": { bare: "אפר" } };
const verb = { id: 1, term: "להפר", forms: JSON.stringify(forms) };
const S = (id, he) => ({ id, he, ru: "…", audioUrl: `${id}.mp3`, lessonId: 5 });

test("токены: без огласовок, конечные буквы приведены, знаки препинания отброшены", () => {
  assert.deepEqual(tokensOf("הִיא מְפֵרָה אֶת הַדְּמָמָה."), ["היא", "מפרה", "את", "הדממה"]);
  assert.deepEqual(tokensOf("\"שלום\", אמר."), ["שלום", "אמר"]);
});

test("глагол: совпадение по форме Pealim, найденная форма возвращается для пропуска", () => {
  const out = sentencesFor(verb, [S(1, "היא מפרה את הדממה."), S(2, "הם מעיזים יותר להפר כללים וחוקים."), S(3, "צריך לצמצם הוצאות.")]);
  assert.deepEqual(out.map((m) => [m.sentenceId, m.matched, m.formId]), [[1, "מפרה", "AP-fs"], [2, "להפר", "INF-L"]]);
});

test("одна приставка снимается, только если остаток — точная форма", () => {
  const out = sentencesFor(verb, [S(1, "הוא אמר שהפר את החוזה."), S(2, "ולהפר אותו אסור."), S(3, "מפריע לי הרעש.")]);
  assert.deepEqual(out.map((m) => [m.sentenceId, m.matched, m.prefix]), [[1, "שהפר", "ש"], [2, "ולהפר", "ו"]]);
});

test("короткие формы (≤ 2 букв после приставки) не матчатся — слишком много ложных", () => {
  const short = { id: 2, term: "לבוא", forms: JSON.stringify({ "PERF-3ms": { bare: "בא" }, "INF-L": { bare: "לבוא" } }) };
  const out = sentencesFor(short, [S(1, "הוא בא הביתה."), S(2, "אני רוצה לבוא."), S(3, "בבא הזה.")]);
  assert.deepEqual(out.map((m) => m.sentenceId), [2]);
});

test("не глагол: только точный токен термина; многословный термин — подряд по токенам; предлог в термине не требуется", () => {
  const noun = { id: 3, term: "דממה", forms: "" };
  assert.deepEqual(sentencesFor(noun, [S(1, "היא מפרה את הדממה."), S(2, "דממה מוחלטת."), S(3, "דממות.")]).map((m) => [m.sentenceId, m.matched]), [[1, "הדממה"], [2, "דממה"]]);
  const multi = { id: 4, term: "בלשון המעטה", forms: "" };
  assert.deepEqual(sentencesFor(multi, [S(1, "דבריו לא נכונים בלשון המעטה."), S(2, "בלשון אחרת.")]).map((m) => m.sentenceId), [1]);
  const withPrep = { id: 5, term: "להסתכסך עם", forms: JSON.stringify({ "INF-L": { bare: "להסתכסך" }, "PERF-1p": { bare: "הסתכסכנו" } }) };
  assert.deepEqual(sentencesFor(withPrep, [S(1, "הפעם הסתכסכנו באופן משמעותי."), S(2, "אני מעדיף לא להסתכסך עם השכנים.")]).map((m) => m.sentenceId), [1, 2]);
});

test("ложные совпадения: подстрока внутри слова, לא ≠ לאט, пустые формы, мусор", () => {
  const lo = { id: 6, term: "לא", forms: "" };
  assert.deepEqual(sentencesFor(lo, [S(1, "הם למדו לאט."), S(2, "הוא לא בא.")]).map((m) => m.sentenceId), [2]);
  assert.deepEqual(sentencesFor({ id: 7, term: "", forms: "" }, [S(1, "שלום")]), []);
  assert.deepEqual(sentencesFor(verb, null), []);
  assert.deepEqual(sentencesFor({ id: 8, term: "להפר", forms: "not json" }, [S(1, "להפר חוקים.")]).map((m) => m.matched), ["להפר"]);
});

test("одно предложение — одна связь, даже если форма встречается дважды; отвергнутые кандидаты возвращаются для лога", () => {
  const res = sentencesFor(verb, [S(1, "הוא לא הפר. הוא לא יפר."), S(2, "מפריע מאוד.")], { withRejected: true });
  assert.deepEqual(res.matches.map((m) => [m.sentenceId, m.matched]), [[1, "הפר"]]);
  assert.ok(res.rejected.some((r) => r.token === "מפריע"));
});
