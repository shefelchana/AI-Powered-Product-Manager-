// Подсказка «что именно разошлось» — серверная копия frontend/src/recall.js (Docker не копирует
// фронтенд на сервер). Тест-близнец hints.test.js гоняет обе реализации на одном наборе — разъехаться не дадут.
const NIQQUD = /[֑-ׇ]/g;
const FINAL_FORMS = { "ם": "מ", "ן": "נ", "ץ": "צ", "ף": "פ", "ך": "כ" };
const NOISE = /[\s.,!?;:"'׳״()\[\]{}\-–—]/g;

export function normalize(text) {
  return String(text ?? "").replace(NIQQUD, "").replace(NOISE, "").replace(/[םןץףך]/g, (l) => FINAL_FORMS[l]).toLowerCase();
}

const LOOKALIKES = [["ב", "כ"], ["ד", "ר"], ["ו", "ז"], ["ח", "ת"], ["ס", "ם"], ["ג", "נ"], ["ג", "ד"], ["ה", "ח"], ["י", "ו"], ["ע", "צ"], ["ט", "מ"]];
const FINAL_OF = { "מ": "ם", "נ": "ן", "צ": "ץ", "פ": "ף", "כ": "ך" };
const lookalike = (a, b) => LOOKALIKES.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
const shown = (letter, at, length) => (at === length - 1 && FINAL_OF[letter] ? FINAL_OF[letter] : letter);

export function missHint(given, expected) {
  const a = normalize(given);
  const b = normalize(expected);
  if (!a || !b || a === b) return null;
  if (a.length === b.length) {
    const diffs = [];
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) diffs.push(i);
    if (diffs.length <= 2 && diffs.every((i) => lookalike(shown(a[i], i, a.length), shown(b[i], i, b.length)))) {
      return "похожие буквы: " + diffs.map((i) => `${shown(a[i], i, a.length)} вместо ${shown(b[i], i, b.length)}`).join(", ");
    }
    if ([...a].sort().join("") === [...b].sort().join("")) return "буквы переставлены местами";
    return null;
  }
  if (Math.abs(a.length - b.length) === 1) {
    const [short, long] = a.length < b.length ? [a, b] : [b, a];
    for (let i = 0; i < long.length; i += 1) {
      if (short === long.slice(0, i) + long.slice(i + 1)) {
        const letter = shown(long[i], i, long.length);
        return a.length < b.length ? `не хватает буквы: ${letter}` : `лишняя буква: ${letter}`;
      }
    }
  }
  return null;
}
