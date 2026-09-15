// «Эхо»: повторение за преподавателем. Только предложения с аудио; ошибочные на
// сайте первыми (там произношение и ритм тоже подводили), затем последний урок,
// затем короткие — ритм и ударение ловятся на коротких. Голос ученицы на сервер
// не приходит: экран сравнивает записи в браузере.
const words = (he) => String(he).trim().split(/\s+/).filter(Boolean).length;

export function pickEcho(sentences, { limit = 6, recentLessonId = null, rng = Math.random } = {}) {
  const list = (Array.isArray(sentences) ? sentences : [])
    .filter((s) => s && typeof s.he === "string" && s.he.trim() && s.audioUrl)
    .map((s) => ({ s, tie: rng() }));
  list.sort((a, b) =>
    Number(b.s.wrongCount ?? 0) - Number(a.s.wrongCount ?? 0)
    || (b.s.lessonId === recentLessonId) - (a.s.lessonId === recentLessonId)
    || words(a.s.he) - words(b.s.he)
    || a.tie - b.tie);
  const n = Math.min(Math.max(parseInt(limit, 10) || 6, 1), 20);
  return list.slice(0, n).map(({ s }) => ({
    id: s.id, he: s.he, heVocalized: s.heVocalized || "", ru: s.ru || "", audioUrl: s.audioUrl, wrong: Number(s.wrongCount ?? 0) > 0,
  }));
}
