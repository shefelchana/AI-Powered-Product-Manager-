// Вкладка «Слова»: поиск и разбиение на секции. Чистые функции — проверяются без браузера.
const NIQQUD = /[֑-ֽֿ-ׇ]/g;
const norm = (s) => String(s ?? "").replace(NIQQUD, "").toLowerCase().trim();

export function searchWords(words, query) {
  const list = Array.isArray(words) ? words : [];
  const q = norm(query);
  if (!q) return list;
  return list.filter((w) => norm(w?.term).includes(q) || norm(w?.translation).includes(q));
}

// «Нужен перевод» — это список дел, он отдельно и сверху; внутри секций — новые сверху.
export function partitionWords(words) {
  const list = Array.isArray(words) ? [...words] : [];
  list.sort((a, b) => (b?.id ?? 0) - (a?.id ?? 0));
  return { needs: list.filter((w) => !String(w?.translation ?? "").trim()), rest: list.filter((w) => String(w?.translation ?? "").trim()) };
}
