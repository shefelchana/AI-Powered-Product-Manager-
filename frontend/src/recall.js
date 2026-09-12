// Строгое вспоминание: сначала пишешь ответ, потом видишь правильный.
// Здесь только чистые функции — их можно гонять тестами без браузера.

const NIQQUD = /[֑-ׇ]/g;
const FINAL_FORMS = { "ם": "מ", "ן": "נ", "ץ": "צ", "ף": "פ", "ך": "כ" };
const NOISE = /[\s.,!?;:"'׳״()\[\]{}\-–—]/g;

// Сравниваем по сути, а не по знакам: огласовки, пробелы, знаки препинания и
// конечные формы букв — не знание, а написание. При дислексии наказывать за них
// значит выключить режим на второй день.
export function normalize(text) {
  return String(text ?? "")
    .replace(NIQQUD, "")
    .replace(NOISE, "")
    .replace(/[םןץףך]/g, (letter) => FINAL_FORMS[letter])
    .toLowerCase();
}

export function matches(given, expected) {
  const left = normalize(given);
  return left.length > 0 && left === normalize(expected);
}

// Вопрос — своя фраза с дыркой на месте слова. Приставки (ה, ו, ב…) остаются
// видимыми: они показывают грамматику, а вписать надо чистую форму.
// Слово, которого нет в фразе дословно (изменённая форма), в строгий режим
// не попадает — угадывать, что именно вырезать, мы не беремся.
export function clozeFor(word) {
  const phrases = String(word?.examples ?? "").split("\n").filter(Boolean);
  const term = String(word?.term ?? "").trim();
  if (!term) return null;

  for (const phrase of phrases) {
    const at = phrase.indexOf(term);
    if (at !== -1) {
      return {
        prompt: phrase.slice(0, at) + "___" + phrase.slice(at + term.length),
        answer: term,
      };
    }
  }
  return null;
}

// ---------- откуда берётся вопрос строгого режима ----------
//
// Приоритет: своя фраза → фраза из урока → перевод → значение из словаря.
// Ничего из этого нет — строгого режима у слова нет, остаётся раскрытие.
// Вопрос, в котором виден сам ответ, не годится: такой источник пропускается.

const SOURCE_LABELS = {
  pealim: "Pealim",
  wiktionary: "Викисловарь",
  academy: "Академия",
  typed: "твоё объяснение",
  generated: "сгенерировано",
  lesson: "из урока",
};

function clozeIn(phrases, term) {
  for (const phrase of phrases) {
    const at = phrase.indexOf(term);
    if (at !== -1) return { prompt: phrase.slice(0, at) + "___" + phrase.slice(at + term.length), answer: term };
  }
  return null;
}

// Строка Академии выглядит как «טַעֲנָה — claim»: слева само слово, справа значение.
// Берём только правую часть, иначе ответ виден в вопросе.
function meaningOf(word) {
  const text = String(word.definition ?? "").trim();
  if (!text) return "";
  if (word.definitionSource !== "academy") return text;
  return text
    .split("\n")
    .map((line) => line.split("—").slice(1).join("—").trim())
    .filter(Boolean)
    .join("; ");
}

const leaks = (prompt, term) => normalize(prompt).includes(normalize(term));
const dirOfText = (text) => (/[֐-׿]/.test(text) ? "rtl" : "ltr");

// Приоритет (уточнено Анной 12.09): важен перевод, а не объяснение.
// Перевод → значение преподавателя → своя фраза → фраза урока → словарь.
// Своя фраза с пропуском при этом остаётся подсказкой рядом с вопросом.
export function promptFor(word) {
  const term = String(word?.term ?? "").trim();
  if (!term) return null;

  const rows = Array.isArray(word.exampleList) && word.exampleList.length > 0
    ? word.exampleList
    : String(word.examples ?? "").split("\n").filter(Boolean).map((text) => ({ text, origin: "own" }));
  const own = clozeIn(rows.filter((r) => r.origin === "own").map((r) => r.text), term);
  const lesson = clozeIn(rows.filter((r) => r.origin === "lesson").map((r) => r.text), term);
  const hint = (own ?? lesson)?.prompt ?? "";

  const translation = String(word.translation ?? "").trim();
  if (translation && !leaks(translation, term)) {
    return { prompt: translation, answer: term, kind: "translation", label: "твой перевод", dir: dirOfText(translation), hint };
  }
  const note = String(word.lessonNote ?? "").trim();
  if (note && !leaks(note, term)) {
    return { prompt: note, answer: term, kind: "note", label: "преподаватель", dir: dirOfText(note), hint };
  }
  if (own) return { ...own, kind: "own", label: "твоя фраза", dir: dirOfText(own.prompt), hint: "" };
  if (lesson) return { ...lesson, kind: "lesson", label: SOURCE_LABELS.lesson, dir: dirOfText(lesson.prompt), hint: "" };

  const meaning = meaningOf(word);
  if (meaning && !leaks(meaning, term)) {
    const label = SOURCE_LABELS[word.definitionSource] ?? "значение";
    return { prompt: meaning, answer: term, kind: "meaning", label, dir: dirOfText(meaning), hint: "" };
  }
  return null;
}

// ---------- выбор перевода из четырёх ----------
//
// Вопрос — слово на иврите, варианты — переводы из колоды: верный и три чужих.
// Чужие переводы, совпадающие с верным, не берутся: два верных ответа — не вопрос.
export function choicesFor(word, pool, rng = Math.random) {
  const correct = String(word?.translation ?? "").trim();
  if (!correct) return null;
  const others = [];
  const seen = new Set([correct]);
  for (const w of Array.isArray(pool) ? pool : []) {
    if (w === word || w?.id === word?.id) continue;
    const tr = String(w?.translation ?? "").trim();
    if (!tr || seen.has(tr)) continue;
    seen.add(tr);
    others.push(tr);
  }
  if (others.length < 3) return null;
  const shuffled = others.map((o) => ({ o, k: rng() })).sort((a, b) => a.k - b.k).map((x) => x.o).slice(0, 3);
  const options = [...shuffled, correct].map((o) => ({ o, k: rng() })).sort((a, b) => a.k - b.k).map((x) => x.o);
  return { options, correct: options.indexOf(correct) };
}
