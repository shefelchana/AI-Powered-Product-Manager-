// Практика как на уроке: составить форму с русского. Всё детерминированно:
// формы — из таблицы Pealim, сохранённой у слова; предлог с местоимением —
// из конечной справочной таблицы. Русский вопрос — перевод слова плюс
// подпись формы словами («она, прошедшее»), русский глагол не спрягаем.
import { FORM_LABELS } from "./conjugation.js";

// Склонение предлогов с местоимениями. Таблица конечная и не меняется.
const P = (ru, he) => ({ ru, he });
export const PREPOSITIONS = {
  "על": [P("я", "עליי"), P("ты (м.)", "עליך"), P("ты (ж.)", "עלייך"), P("он", "עליו"), P("она", "עליה"), P("мы", "עלינו"), P("вы (м.)", "עליכם"), P("вы (ж.)", "עליכן"), P("они (м.)", "עליהם"), P("они (ж.)", "עליהן")],
  "ב": [P("я", "בי"), P("ты (м.)", "בך"), P("ты (ж.)", "בך"), P("он", "בו"), P("она", "בה"), P("мы", "בנו"), P("вы (м.)", "בכם"), P("вы (ж.)", "בכן"), P("они (м.)", "בהם"), P("они (ж.)", "בהן")],
  "ל": [P("я", "לי"), P("ты (м.)", "לך"), P("ты (ж.)", "לך"), P("он", "לו"), P("она", "לה"), P("мы", "לנו"), P("вы (м.)", "לכם"), P("вы (ж.)", "לכן"), P("они (м.)", "להם"), P("они (ж.)", "להן")],
  "עם": [P("я", "איתי"), P("ты (м.)", "איתך"), P("ты (ж.)", "איתך"), P("он", "איתו"), P("она", "איתה"), P("мы", "איתנו"), P("вы (м.)", "איתכם"), P("вы (ж.)", "איתכן"), P("они (м.)", "איתם"), P("они (ж.)", "איתן")],
  "את": [P("я", "אותי"), P("ты (м.)", "אותך"), P("ты (ж.)", "אותך"), P("он", "אותו"), P("она", "אותה"), P("мы", "אותנו"), P("вы (м.)", "אתכם"), P("вы (ж.)", "אתכן"), P("они (м.)", "אותם"), P("они (ж.)", "אותן")],
  "מ": [P("я", "ממני"), P("ты (м.)", "ממך"), P("ты (ж.)", "ממך"), P("он", "ממנו"), P("она", "ממנה"), P("мы", "מאיתנו"), P("вы (м.)", "מכם"), P("вы (ж.)", "מכן"), P("они (м.)", "מהם"), P("они (ж.)", "מהן")],
  "אל": [P("я", "אליי"), P("ты (м.)", "אליך"), P("ты (ж.)", "אלייך"), P("он", "אליו"), P("она", "אליה"), P("мы", "אלינו"), P("вы (м.)", "אליכם"), P("вы (ж.)", "אליכן"), P("они (м.)", "אליהם"), P("они (ж.)", "אליהן")],
  "בין": [P("я", "ביני"), P("ты (м.)", "בינך"), P("ты (ж.)", "בינך"), P("он", "בינו"), P("она", "בינה"), P("мы", "בינינו"), P("вы (м.)", "ביניכם"), P("вы (ж.)", "ביניכן"), P("они (м.)", "ביניהם"), P("они (ж.)", "ביניהן")],
};

// «להקל על», «לשלוט ב-», «להסתכסך עם» → предлог в конце словосочетания.
export function prepositionOf(term) {
  const words = String(term ?? "").trim().replace(/-$/, "").split(/\s+/);
  if (words.length < 2) return null;
  const last = words[words.length - 1].replace(/-$/, "");
  return PREPOSITIONS[last] ? last : null;
}

const ASKABLE_FORMS = Object.keys(FORM_LABELS);

function formsOf(word) {
  if (!word?.forms) return null;
  try {
    const forms = typeof word.forms === "string" ? JSON.parse(word.forms) : word.forms;
    return forms && typeof forms === "object" ? forms : null;
  } catch {
    return null;
  }
}

// Вопрос — по-русски или по-английски, никогда не на иврите: у строки Академии
// («מוּדָע — aware») берём часть после тире; вопрос, в котором виден ответ, не годится.
const NIQQUD_RE = /[֑-ׇ]/g;
const bare = (text) => String(text ?? "").replace(NIQQUD_RE, "").replace(/[\s.,!?;:"'׳״()\[\]{}\-–—]/g, "").toLowerCase();
function meaningOf(word) {
  const own = String(word.translation || word.lessonNote || "").trim();
  if (own) return own;
  const definition = String(word.definition ?? "").trim();
  if (!definition) return "";
  const text = word.definitionSource === "academy"
    ? definition.split("\n").map((line) => line.split("—").slice(1).join("—").trim()).filter(Boolean).join("; ")
    : definition;
  const head = String(word.term ?? "").trim().split(/\s+/)[0];
  if (!text || /[א-ת]/.test(text) || (head && bare(text).includes(bare(head)))) return "";
  return text;
}

function pick(list, rng) {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

// Вопрос — перевод + подпись формы; ответ — форма без огласовок, с огласовками
// на показ. Слова последнего урока идут первыми, остальное — в случайном порядке.
export function buildExercises(words, { limit = 10, rng = Math.random, recentLessonId = null } = {}) {
  const out = [];
  for (const word of Array.isArray(words) ? words : []) {
    const meaning = meaningOf(word);
    if (!meaning) continue;
    const forms = formsOf(word);
    if (forms) {
      const ids = ASKABLE_FORMS.filter((id) => forms[id]?.bare);
      if (ids.length > 0) {
        const formId = pick(ids, rng);
        out.push({
          kind: "form",
          wordId: word.id,
          term: word.term,
          prompt: meaning,
          label: `${FORM_LABELS[formId].ru} · ${FORM_LABELS[formId].pronoun}`,
          formId,
          answer: forms[formId].bare,
          answerVocalized: forms[formId].vocalized,
          recent: word.lessonId != null && word.lessonId === recentLessonId,
        });
        continue;
      }
    }
    const prep = prepositionOf(word.term);
    if (prep) {
      const head = String(word.term).trim().replace(/-$/, "").split(/\s+/).slice(0, -1).join(" ");
      const person = pick(PREPOSITIONS[prep], rng);
      out.push({
        kind: "preposition",
        wordId: word.id,
        term: word.term,
        prompt: meaning,
        label: `${prep} + ${person.ru}`,
        formId: `${prep}:${person.ru}`,
        answer: `${head} ${person.he}`,
        answerVocalized: "",
        recent: word.lessonId != null && word.lessonId === recentLessonId,
      });
    }
  }
  // Сначала слова последнего урока, внутри групп — случайно.
  const shuffled = out.map((ex) => ({ ex, key: rng() })).sort((a, b) => Number(b.ex.recent) - Number(a.ex.recent) || a.key - b.key).map((x) => x.ex);
  return shuffled.slice(0, Math.max(0, limit));
}
