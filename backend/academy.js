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

// Приставки иврита: слово, записанное с лекции как «המיזוג», в словаре
// не найдётся — там оно лежит как «מיזוג».
const PREFIXES = new Set(["ו", "ה", "ב", "כ", "ל", "מ", "ש"]);

// Что пробовать искать и в каком порядке: сначала как написано, потом
// без одной приставки, потом без двух. Остаток короче трёх букв не пробуем:
// у מים («вода») отрезание первой буквы даёт ים («море») — другое настоящее
// слово, и оно молча подставилось бы вместо искомого.
export function searchVariants(term) {
  const clean = stripNiqqud(String(term ?? ""));
  const variants = [clean];
  let rest = clean;
  for (let i = 0; i < 2; i += 1) {
    if (!PREFIXES.has(rest[0]) || rest.length - 1 < 3) break;
    rest = rest.slice(1);
    variants.push(rest);
  }
  return variants.filter(Boolean);
}

// В выдаче Академии ярлыки в огласованном письме («מזוג»), а записывают слова
// в обычном («מיזוג») — разница в буквах-матерях чтения. Для сопоставления
// с выдачей их отбрасываем. В проверке ответов такое сравнение недопустимо:
// там оно уравняло бы שיר и שר. Здесь риск мал — кандидаты пришли по запросу
// этого же слова, и совпадение должно остаться единственным.
const bare = (text) => stripNiqqud(text).replace(/[יו]/g, "");

// Что из выдачи можно предложить человеку как варианты. Раньше при полном
// промахе показывались первые пять ссылок как есть — и на «לכת» (от ללכת)
// приходили «שיר לכת» (марш) и «לכת ניטרוצלולוזה» (лак): правдоподобный мусор
// хуже честного «нет данных». Оставляем только совпадающих по голому написанию —
// омографы, различимые лишь огласовкой, именно так и выглядят.
export function offerCandidates(links, variant) {
  return links.filter((link) => bare(link.label) === bare(variant)).slice(0, 5);
}

// Ссылки из выдачи принимаем только свои: адрес приходит с клиента.
export const isTermPath = (href) => /^\/munnah\/[0-9]+_[0-9]+$/.test(String(href ?? ""));

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

function linksOf(html) {
  const seen = new Set();
  return [...html.matchAll(/<a[^>]*href="(\/munnah\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((match) => {
      const text = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return {
        href: match[1],
        // Для сопоставления — без огласовок; для показа — с ними: два разных
        // слова могут писаться одинаково и различаться только огласовкой
        // (חִבְרוּת «социализация» и חֲבֵרוּת «членство»).
        label: stripNiqqud(text),
        display: text,
      };
    })
    .filter((link) => link.label && !seen.has(link.href) && seen.add(link.href));
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

// Возвращает запись только при точном совпадении. Раньше при промахе бралась
// первая ссылка из выдачи — и на «רכישת» приходило «רְכִישַׁת נְתוּנִים —
// data acquisition»: правдоподобная запись с настоящей подписью Академии,
// но не про то слово. Молчаливая подмена хуже отсутствия ответа.
// Нет точного совпадения — отдаём варианты, выбирает человек.
export async function lookup(term) {
  let candidates = [];

  for (const variant of searchVariants(term)) {
    const links = linksOf(await fetchText(`${BASE}/?Filter.SearchString=${encodeURIComponent(variant)}`));
    if (links.length === 0) continue;

    const exact = links.filter((link) => link.label === variant);
    if (exact.length === 1) return fetchRecord(exact[0].href);

    const loose = exact.length > 0 ? exact : links.filter((link) => bare(link.label) === bare(variant));
    if (loose.length === 1) return fetchRecord(loose[0].href);

    if (candidates.length === 0) candidates = offerCandidates(links, variant);
  }

  return candidates.length > 0 ? { candidates } : null;
}

export async function fetchRecord(href) {
  const entries = parseEntries(await fetchText(BASE + href));
  if (entries.length === 0) return null;
  const chosen = { href };

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
