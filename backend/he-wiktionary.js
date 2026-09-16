// Толкование на иврите из Викисловаря на иврите (he.wiktionary.org, CC BY-SA 4.0).
// Покрытие частичное: нет статьи — нет толкования, ничего не выдумываем.
// Ищем по лемме: у глагола это прошедшее 3 л. ед. ч. м. р. (из форм Pealim), у остальных — термин.
const API = "https://he.wiktionary.org/w/api.php";
const MAX_DEFINITIONS = 2;
const PREPOSITION_TAIL = new Set(["על", "ב", "ל", "עם", "את", "מ", "אל", "בין"]);

export function lemmaFor(word) {
  let forms = {};
  try { forms = typeof word?.forms === "string" ? JSON.parse(word.forms || "{}") : (word?.forms ?? {}); } catch { forms = {}; }
  const past = forms?.["PERF-3ms"]?.bare;
  if (past) return String(past);
  const toks = String(word?.term ?? "").trim().split(/\s+/).filter(Boolean);
  if (toks.length > 1 && PREPOSITION_TAIL.has(toks[toks.length - 1].replace(/-$/, ""))) toks.pop();
  return toks.join(" ");
}

const stripMarkup = (line) => line
  .replace(/\{\{[^{}]*\}\}/g, "")                    // шаблоны {{...}}
  .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")   // ссылки [[a|b]] → b
  .replace(/'{2,}/g, "")                              // курсив/жирный
  .replace(/<[^>]+>/g, "")
  .replace(/\s{2,}/g, " ")
  .trim();

export function parseDefinitions(wikitext) {
  const lines = String(wikitext ?? "").split("\n");
  const defs = [];
  for (const raw of lines) {
    if (!/^#(?![:*#])/.test(raw)) continue;   // «#» — определение; «#:» пример, «#*» цитата
    const text = stripMarkup(raw.replace(/^#\s*/, ""));
    if (text) defs.push(text);
    if (defs.length >= MAX_DEFINITIONS) break;
  }
  return defs.length > 0 ? defs : null;
}

export function attribution(lemma) {
  return {
    label: "Викисловарь на иврите, CC BY-SA 4.0",
    url: `https://he.wiktionary.org/wiki/${encodeURIComponent(lemma)}`,
  };
}

export async function lookupHeWiktionary(word, { fetchImpl = fetch } = {}) {
  const lemma = lemmaFor(word);
  if (!lemma) return null;
  const url = `${API}?action=parse&page=${encodeURIComponent(lemma)}&prop=wikitext&format=json&formatversion=2`;
  const res = await fetchImpl(url, { headers: { "User-Agent": "slova-s-zanyatiy/1.0 (personal Hebrew vocab app)" }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Викисловарь: HTTP ${res.status}`);
  const data = await res.json();
  if (data?.error) return null;                       // нет статьи — не ошибка, а «не нашли»
  const defs = parseDefinitions(data?.parse?.wikitext);
  if (!defs) return null;
  const { label, url: link } = attribution(lemma);
  return { text: defs.map((d, i) => `${i + 1}. ${d}`).join("\n"), label, url: link, lemma };
}
