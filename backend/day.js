// Слово дня — по видимому правилу, чтобы было понятно, почему именно оно
// (Анна, 12.09, вариант А). Приоритет: не держится → с последнего урока, ещё не
// повторялось → новое → повторение из низких коробок. Вчерашнее не берём два дня
// подряд. Чистая функция: маршрут только собирает входы и сохраняет выбор.
const HARD_MISSES = 2;

export const REASONS = {
  lesson: "с последнего урока, ещё не повторялось",
  fresh: "новое: добавлено, но ещё не вспоминалось",
  repeat: "повторение: из первых коробок",
};

const plural = (n) => {
  const tail = n % 10;
  const teen = n % 100 >= 11 && n % 100 <= 14;
  if (tail === 1 && !teen) return "промах";
  if (tail >= 2 && tail <= 4 && !teen) return "промаха";
  return "промахов";
};

// Вспоминалось ли слово: запись в журнале, либо следы до журнала — коробка выше
// первой или промахи.
const seenBy = (reviewedIds) => (w) => reviewedIds.has(w.id) || Number(w.box) > 1 || Number(w.misses) > 0;

const byOldest = (a, b) => new Date(a.createdAt) - new Date(b.createdAt) || a.id - b.id;
const yesterdayOf = (today) => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export function pickWordOfDay(words, { lastLessonId = null, reviewedIds = new Set(), today }) {
  const all = Array.isArray(words) ? words : [];
  if (all.length === 0) return null;
  const yesterday = yesterdayOf(today);
  const fresh = all.filter((w) => w.dayPickedAt !== yesterday);
  const pool = fresh.length > 0 ? fresh : all;

  const hard = pool.filter((w) => Number(w.misses) >= HARD_MISSES).sort((a, b) => Number(b.misses) - Number(a.misses) || byOldest(a, b));
  if (hard.length > 0) return { word: hard[0], reason: `не держится: ${hard[0].misses} ${plural(Number(hard[0].misses))}` };

  const seen = seenBy(reviewedIds);
  const lesson = pool.filter((w) => lastLessonId != null && w.lessonId === lastLessonId && !seen(w)).sort(byOldest);
  if (lesson.length > 0) return { word: lesson[0], reason: REASONS.lesson };

  const never = pool.filter((w) => !seen(w)).sort(byOldest);
  if (never.length > 0) return { word: never[0], reason: REASONS.fresh };

  const low = pool.filter((w) => Number(w.box) <= 2);
  const repeat = (low.length > 0 ? low : pool).slice().sort((a, b) => String(a.dayPickedAt ?? "").localeCompare(String(b.dayPickedAt ?? "")) || byOldest(a, b));
  return { word: repeat[0], reason: REASONS.repeat };
}

// Причина для конкретного слова — то же правило, без выбора между словами.
export function reasonFor(word, { lastLessonId = null, reviewedIds = new Set() }) {
  const misses = Number(word.misses) || 0;
  if (misses >= HARD_MISSES) return `не держится: ${misses} ${plural(misses)}`;
  const seen = seenBy(reviewedIds);
  if (lastLessonId != null && word.lessonId === lastLessonId && !seen(word)) return REASONS.lesson;
  if (!seen(word)) return REASONS.fresh;
  return REASONS.repeat;
}
