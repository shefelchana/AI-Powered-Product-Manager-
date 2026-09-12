// Режим «Учить» по механике Quizlet Learn: раунд из нескольких слов, каждое
// проходит две ступени — узнать перевод (выбор из четырёх) и вспомнить слово
// (написать на иврите). Ошибка возвращает на ступень назад и ставит слово
// снова в очередь того же раунда. Раунд закончен, когда все слова прошли обе
// ступени. Чистая машина состояний, без React.
import { test } from "node:test";
import assert from "node:assert/strict";
import { startRound, nextStep, applyResult, roundSummary } from "./learn.js";

const pool = [
  { id: 1, term: "לצמצם", translation: "сокращать", box: 1 },
  { id: 2, term: "מענק", translation: "грант", box: 1 },
  { id: 3, term: "לשרוד", translation: "выжить", box: 4 },
  { id: 4, term: "לגרש", translation: "прогнать", box: 1 },
  { id: 5, term: "ריב", translation: "", box: 1, lessonNote: "ссора" },
  { id: 6, term: "סכסוך", translation: "конфликт", box: 2 },
];

test("раунд: новые слова начинают с выбора, знакомые (коробка ≥ 3) — сразу с написания", () => {
  const r = startRound(pool.slice(0, 4), pool, () => 0.5);
  const first = nextStep(r);
  assert.equal(first.word.id, 1);
  assert.equal(first.stage, "choose");
  assert.equal(first.choice.options.length, 4);
  const steps = [];
  let s = r;
  for (let i = 0; i < 4; i += 1) { const st = nextStep(s); steps.push([st.word.id, st.stage]); s = applyResult(s, st, true); }
  assert.deepEqual(steps, [[1, "choose"], [2, "choose"], [3, "type"], [4, "choose"]]);
});

test("верный выбор ведёт к написанию того же слова позже в раунде; верное написание — слово освоено", () => {
  let r = startRound(pool.slice(0, 1), pool, () => 0.5);
  let st = nextStep(r); assert.equal(st.stage, "choose");
  r = applyResult(r, st, true);
  st = nextStep(r); assert.equal(st.stage, "type"); assert.equal(st.word.id, 1);
  r = applyResult(r, st, true);
  assert.equal(nextStep(r), null, "раунд закончен");
  assert.deepEqual(roundSummary(r), { mastered: 1, total: 1, known: [1], unknown: [] });
});

test("ошибка на выборе — слово остаётся на выборе и уходит в конец очереди; ошибка на написании — назад к выбору", () => {
  let r = startRound(pool.slice(0, 2), pool, () => 0.5);
  let st = nextStep(r); assert.equal(st.word.id, 1);
  r = applyResult(r, st, false);
  st = nextStep(r); assert.equal(st.word.id, 2, "после ошибки идёт следующее слово, а не то же");
  r = applyResult(r, st, true);
  st = nextStep(r); assert.equal(st.word.id, 1); assert.equal(st.stage, "choose");
  r = applyResult(r, st, true);
  st = nextStep(r); assert.equal(st.word.id, 2); assert.equal(st.stage, "type");
  r = applyResult(r, st, false);
  st = nextStep(r); assert.equal(st.word.id, 1); assert.equal(st.stage, "type");
  r = applyResult(r, st, true);
  st = nextStep(r); assert.equal(st.word.id, 2); assert.equal(st.stage, "choose", "после промаха на написании — снова выбор");
});

test("итог раунда: освоено без ошибок на написании — «знаю», с ошибкой на написании — «не знаю»", () => {
  let r = startRound(pool.slice(0, 2), pool, () => 0.5);
  // слово 1: всё верно; слово 2: промах на написании, потом верно
  const play = (id, stage, ok) => { const st = nextStep(r); assert.equal(st.word.id, id); assert.equal(st.stage, stage); r = applyResult(r, st, ok); };
  play(1, "choose", true); play(2, "choose", true); play(1, "type", true); play(2, "type", false); play(2, "choose", true); play(2, "type", true);
  assert.equal(nextStep(r), null);
  assert.deepEqual(roundSummary(r), { mastered: 2, total: 2, known: [1], unknown: [2] });
});

test("слово без перевода, но с заметкой преподавателя — варианты из заметки; совсем без значения — только написание", () => {
  const r = startRound([pool[4]], pool, () => 0.5);
  const st = nextStep(r);
  assert.equal(st.stage, "choose");
  assert.ok(st.choice.options.includes("ссора"));
  const bare = startRound([{ id: 9, term: "בוקר", translation: "", box: 1 }], pool, () => 0.5);
  assert.equal(nextStep(bare).stage, "type");
});

test("«не знаю» — это ошибка: слово возвращается в очередь", () => {
  let r = startRound(pool.slice(0, 1), pool, () => 0.5);
  let st = nextStep(r);
  r = applyResult(r, st, false);
  assert.notEqual(nextStep(r), null);
});
