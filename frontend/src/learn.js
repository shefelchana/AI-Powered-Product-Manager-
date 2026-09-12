// Режим «Учить» — по механике Quizlet Learn.
//
// Раунд — несколько слов. У каждого две ступени:
//   choose — узнать перевод: слово на иврите, четыре варианта по-русски;
//   type   — вспомнить слово: перевод по-русски, написать на иврите.
// Верный ответ поднимает на ступень, ошибка (и «не знаю») опускает на ступень
// назад, и слово уходит в конец очереди раунда — спросим ещё раз, но не сразу.
// Слово освоено, когда написано верно. Раунд закончен, когда освоены все.
// Знакомые слова (коробка ≥ 3) начинают сразу с написания: выбор для них — шаг назад.
// В расписание раунд уходит одним ответом на слово: «знаю», если на написании
// не было ни одного промаха, иначе «не знаю».
import { choicesFor, promptFor } from "./recall.js";

const meaningFor = (word) => String(word.translation || word.lessonNote || "").trim();
const canChoose = (word, pool, rng) => Boolean(choicesFor({ ...word, translation: meaningFor(word) }, pool.map((w) => ({ ...w, translation: meaningFor(w) })), rng));

export function startRound(words, pool, rng = Math.random) {
  const queue = words.map((word) => ({
    word,
    stage: Number(word.box) >= 3 || !canChoose(word, pool, rng) ? "type" : "choose",
    typeMisses: 0,
    mastered: false,
  }));
  return { queue, pool, rng, done: [] };
}

// Следующий шаг: первое неосвоенное слово в очереди, с готовым вопросом.
export function nextStep(round) {
  const item = round.queue.find((q) => !q.mastered);
  if (!item) return null;
  if (item.stage === "choose") {
    const word = { ...item.word, translation: meaningFor(item.word) };
    const pool = round.pool.map((w) => ({ ...w, translation: meaningFor(w) }));
    return { word: item.word, stage: "choose", choice: choicesFor(word, pool, round.rng) };
  }
  return { word: item.word, stage: "type", cloze: promptFor(item.word) };
}

export function applyResult(round, step, ok) {
  const queue = round.queue.filter((q) => q.word.id !== step.word.id);
  const item = round.queue.find((q) => q.word.id === step.word.id);
  if (!item) return round;
  let next;
  if (step.stage === "choose") {
    next = { ...item, stage: ok ? "type" : "choose" };
  } else {
    next = ok
      ? { ...item, mastered: true }
      : { ...item, stage: canChoose(item.word, round.pool, round.rng) ? "choose" : "type", typeMisses: item.typeMisses + 1 };
  }
  // Освоенное остаётся на месте (для итога), неосвоенное — в конец очереди.
  return { ...round, queue: next.mastered ? [...queue, next] : [...queue, next] };
}

export function roundSummary(round) {
  const known = round.queue.filter((q) => q.mastered && q.typeMisses === 0).map((q) => q.word.id);
  const unknown = round.queue.filter((q) => !(q.mastered && q.typeMisses === 0)).map((q) => q.word.id);
  return { mastered: round.queue.filter((q) => q.mastered).length, total: round.queue.length, known, unknown };
}
