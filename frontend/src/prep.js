// Подготовка к уроку: что повторить накануне и что спросить.
// Чистые функции — гоняются тестами без браузера.

// Последний законченный урок: тот, что идёт сейчас, повторять рано.
// Законченных нет — берём последний по дате, какой есть.
export function lessonSummary(words, lessons) {
  const list = Array.isArray(lessons) ? [...lessons] : [];
  list.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
  const lesson = list.find((l) => l.finishedAt) ?? list[0] ?? null;
  const all = Array.isArray(words) ? words : [];
  return {
    lesson,
    words: lesson ? all.filter((w) => w.lessonId === lesson.id) : [],
    questions: all.filter((w) => w.question),
  };
}

export const formatDate = (iso) => {
  const [, m, d] = String(iso ?? "").split("-");
  return d && m ? `${d}.${m}` : String(iso ?? "");
};
