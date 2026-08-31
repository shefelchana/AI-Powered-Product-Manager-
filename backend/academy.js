// Справка из базы терминов Академии языка иврит (terms.hebrew-academy.org.il).
// Открытого API у неё нет, но страница термина отдаёт структурированные данные
// в блоке ld+json — их и читаем, а не сырую разметку: она переживёт правку вёрстки.
//
// Академия даёт терминологическую справку, не толкование: огласовку, область,
// английский эквивалент и словарь-источник с годом. Подпись обязательна.
const BASE = "https://terms.hebrew-academy.org.il";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const TIMEOUT_MS = 10000;
const MAX_ENTRIES = 3;

const stripNiqqud = (text) => text.replace(/[֑-ׇ]/g, "").trim();

const unescapeHtml = (text) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "he,en" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Академия ответила ${res.status}`);
  return res.text();
}

// Из страницы поиска берём ссылку на термин: точное совпадение без огласовок,
// иначе первое в списке.
function pickTerm(html, term) {
  const links = [...html.matchAll(/<a[^>]*href="(\/munnah\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(
    (match) => ({
      href: match[1],
      label: stripNiqqud(match[2].replace(/<[^>]+>/g, " ")),
    })
  );
  if (links.length === 0) return null;
  const wanted = stripNiqqud(term);
  return links.find((link) => link.label === wanted) ?? links[0];
}

function parseEntries(html) {
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!block) return [];
  let raw;
  try {
    raw = JSON.parse(unescapeHtml(block[1]));
  } catch {
    return [];
  }
  return (Array.isArray(raw) ? raw : [raw]).slice(0, MAX_ENTRIES).map((entry) => ({
    hebrew: entry.name ?? "",
    english: (entry.hasPart ?? []).map((part) => part.name).filter(Boolean).join(", "),
    dictionary: entry.publication?.name ?? "",
    year: entry.copyrightYear ?? "",
  }));
}

// null означает «в базе Академии такого нет» — это не ошибка, а ответ.
export async function lookup(term) {
  const search = await fetchText(`${BASE}/?Filter.SearchString=${encodeURIComponent(term)}`);
  const chosen = pickTerm(search, term);
  if (!chosen) return null;

  const entries = parseEntries(await fetchText(BASE + chosen.href));
  if (entries.length === 0) return null;

  // Записи из разных словарей часто повторяют друг друга: одна даёт
  // "merger, amalgamation", следующая — только "merger". Оставляем те, что
  // добавляют что-то новое.
  const kept = [];
  for (const entry of entries) {
    const line = `${entry.hebrew} — ${entry.english}`.trim();
    const isRepeat = kept.some(
      (k) => k.line === line || (entry.english && k.entry.english.includes(entry.english))
    );
    if (!isRepeat) kept.push({ line, entry });
  }

  const sources = [
    ...new Set(
      kept
        .map(({ entry }) => [entry.dictionary, entry.year].filter(Boolean).join(", "))
        .filter(Boolean)
    ),
  ];

  return {
    definition: kept.map(({ line }) => line).join("\n"),
    sourceLabel: ["האקדמיה ללשון העברית", ...sources].join(" · "),
    sourceUrl: BASE + chosen.href,
  };
}
