// Подготовка к уроку: что повторить накануне и что спросить.
// Чистые функции — гоняются тестами без браузера.

// Последний законченный урок: тот, что идёт сейчас, повторять рано.
// Законченных нет — берём последний по дате, какой есть.
export function lessonSummary(words, lessons) {
  const list = Array.isArray(lessons) ? [...lessons] : [];
  list.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
  const lesson = list.find((l) => l.finishedAt) ?? list[0] ?? null;
  const all = Array.isArray(words) ? words : [];
  // Один день — один урок (Анна, 16.09): классная, домашняя и своя запись той же даты идут вместе.
  // Свой урок той же даты, который ещё идёт (finishedAt пуст), не берём: повторять вписанное 10 минут назад рано.
  const sameDay = lesson ? new Set(list.filter((l) => String(l.date) === String(lesson.date) && l.finishedAt).map((l) => l.id)) : new Set();
  return {
    lesson,
    words: lesson ? all.filter((w) => sameDay.has(w.lessonId)) : [],
    questions: all.filter((w) => w.question),
  };
}

export const formatDate = (iso) => {
  const [, m, d] = String(iso ?? "").split("-");
  return d && m ? `${d}.${m}` : String(iso ?? "");
};
