// Фразы урока → к слову. Точность важнее полноты (ревью 16.09): только целые токены;
// глагол — по формам Pealim; не глагол — точный токен термина (многословный — подряд);
// одна приставка ו/ה/ש/כ/ב/ל/מ снимается, только если остаток — точная форма длиной ≥ 3.
// Морфологию не изобретаем: чего нет в формах — не находим. Отвергнутые кандидаты
// (токены, похожие на форму, но не совпавшие) отдаём для лога.
const NIQQUD = /[֑-ֽֿ-ׇ]/g;
const FINALS = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
const PREFIXES = ["ו", "ה", "ש", "כ", "ב", "ל", "מ"];
const MIN_STEM = 3;

const unfinal = (s) => s.replace(/[ךםןףץ]/g, (c) => FINALS[c]);
export const canon = (s) => unfinal(String(s ?? "").replace(NIQQUD, ""));

export function tokensOf(text) {
  return String(text ?? "")
    .replace(NIQQUD, "")
    .split(/[\s־.,!?;:()"'«»\[\]{}\-–—/]+/)
    .map((t) => t.replace(/^[^א-ת]+|[^א-ת]+$/g, ""))
    .filter(Boolean);
}

function formsOf(word) {
  if (!word?.forms) return {};
  try {
    const f = typeof word.forms === "string" ? JSON.parse(word.forms) : word.forms;
    return f && typeof f === "object" ? f : {};
  } catch {
    return {};
  }
}

// Термин без служебного предлога в конце («להסתכסך עם» → «להסתכסך»), токенами.
const PREPOSITION_TAIL = new Set(["על", "ב", "ל", "עם", "את", "מ", "אל", "בין"]);
const MIN_BARE_STEM_WITH_PREFIX = 4; // у термина без форм приставку снимаем только от 4 букв: «פרה» ≠ «מפרה»
function termTokens(term) {
  const toks = tokensOf(term);
  if (toks.length > 1 && PREPOSITION_TAIL.has(toks[toks.length - 1])) toks.pop();
  return toks;
}

export function sentencesFor(word, sentences, { withRejected = false } = {}) {
  const list = Array.isArray(sentences) ? sentences : [];
  const term = termTokens(word?.term);
  const matches = [];
  const rejected = [];
  if (term.length === 0) return withRejected ? { matches, rejected } : matches;

  // Таблица форм: каноническое написание → id формы. Голый термин — тоже форма.
  const table = new Map();
  for (const [id, f] of Object.entries(formsOf(word))) {
    const bare = canon(f?.bare ?? "");
    if (bare.length >= MIN_STEM) table.set(bare, id);
  }
  const single = term.length === 1 ? canon(term[0]) : null;
  if (single && !table.has(single)) table.set(single, "term");

  // «Похоже на форму»: три буквы подряд из какой-то формы есть в токене — кандидат в лог.
  const grams = new Set();
  for (const bare of table.keys()) for (let i = 0; i + 3 <= bare.length; i++) grams.add(bare.slice(i, i + 3));
  const looksLike = (c) => { for (const g of grams) if (c.includes(g)) return true; return false; };

  const lookup = (token) => {
    const c = canon(token);
    if (table.has(c)) return { formId: table.get(c), prefix: "" };
    if (c.length > MIN_STEM && PREFIXES.includes(c[0]) && table.has(c.slice(1))) {
      const formId = table.get(c.slice(1));
      // Настоящая форма Pealim — приставка допустима; голый термин — только если стем длинный.
      if (formId !== "term" || c.slice(1).length >= MIN_BARE_STEM_WITH_PREFIX) return { formId, prefix: c[0] };
    }
    return null;
  };

  for (const s of list) {
    if (!s || typeof s.he !== "string") continue;
    const toks = tokensOf(s.he);
    let hit = null;
    if (term.length > 1) {
      // Многословный термин: те же токены подряд, у первого допустима приставка.
      const want = term.map(canon);
      for (let i = 0; i + want.length <= toks.length && !hit; i++) {
        const head = canon(toks[i]);
        const headOk = head === want[0] || (head.length > want[0].length && PREFIXES.includes(head[0]) && head.slice(1) === want[0]);
        if (headOk && want.slice(1).every((w, k) => canon(toks[i + 1 + k]) === w)) {
          // Найденный отрезок — из исходного текста (пробелы/макаф как есть), чтобы он был подстрокой фразы.
          const span = new RegExp(toks.slice(i, i + want.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\u05BE]+"));
          const found = String(s.he).replace(NIQQUD, "").match(span);
          hit = { matched: found ? found[0] : toks.slice(i, i + want.length).join(" "), formId: "term", prefix: head === want[0] ? "" : head[0] };
        }
      }
    } else {
      for (const t of toks) {
        const found = lookup(t);
        if (found) { hit = { matched: t, ...found }; break; }
        // Похоже на форму (общий корень из 3 букв), но не форма — в лог.
        if (withRejected && looksLike(canon(t))) rejected.push({ sentenceId: s.id, token: t });
      }
    }
    if (hit) matches.push({ sentenceId: s.id, wordId: word.id ?? null, ...hit });
  }
  return withRejected ? { matches, rejected } : matches;
}
