// Грубое сравнение значений из двух источников. Намеренно осторожное в сторону
// «пометить спорным»: ложная тревога стоит строки в отчёте, а молча записанное
// неверное объяснение — выученного неправильно слова.
const STOP = new Set(["the", "and", "for", "with", "that", "from", "into"]);

export function significantWords(text) {
  const words = String(text ?? "").toLowerCase().match(/[a-z]{4,}/g) ?? [];
  return new Set(words.filter((word) => !STOP.has(word)));
}

export function sourcesDisagree(first, second) {
  const a = significantWords(first);
  const b = significantWords(second);
  // Сравнивать нечего — молчание не является противоречием.
  if (a.size === 0 || b.size === 0) return false;
  return ![...a].some((word) => b.has(word));
}
