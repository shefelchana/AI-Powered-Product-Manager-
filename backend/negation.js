// «Сделай отрицание» из предложений преподавателя. Ничего не сочиняем: берём
// предложение с «לא»/«אין», показываем его утвердительную версию, эталон — оригинал.
// Обратное преобразование детерминировано; прямое (вставить «לא» в любое
// предложение) требует знать, где глагол, — это отдельный шаг.
// Огласовки — без макафа (U+05BE): «בית־ספר» должен остаться словом с дефисом.
const NIQQUD_RE = /[֑-ֽֿ-ׇ]/g;
const bare = (text) => String(text ?? "").replace(NIQQUD_RE, "");

// «לא» и «אין» — только как отдельные слова (לאט, לאן, אינטרנט не трогаем).
const NOT_RE = /(^|[\s,("'«])לא(?=$|[\s.,!?;:)"'»])/g;
const EIN_RE = /(^|[\s,("'«])אין(?=$|[\s.,!?;:)"'»])/g;
// Что остаётся отрицанием и после снятия «לא»/«אין»: приставочные формы (ולא, שלא, כשלא, הלא),
// «אל» (повеление), «אף/שום/מעולם/בכלל» — усилители, без «לא» они ломают фразу; «אלא» — «не …, а».
const STILL_NEGATIVE_RE = /(^|[\s,("'«])(?:[ושכה]?ש?לא|אינ(?:ו|ה|ם|ן|ני|נו|כם|כן)?|אל|אף|שום|מעולם|בכלל|בלי|אלא)(?=$|[\s.,!?;:)"'»])/;
const EMPTY_QUOTES_RE = /["'«»]\s*["'«»]/;

export function affirmativeOf(he) {
  const text = bare(he).trim();
  if (!text) return null;
  const hasNot = NOT_RE.test(text) || EIN_RE.test(text);
  NOT_RE.lastIndex = 0; EIN_RE.lastIndex = 0;
  if (!hasNot) return null;
  const out = text
    .replace(EIN_RE, "$1יש")
    .replace(NOT_RE, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;:]+/, "")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
  // Отрицание осталось (ולא, אף פעם…) или фраза без него неграмотна — не предлагать.
  if (!out || STILL_NEGATIVE_RE.test(out) || EMPTY_QUOTES_RE.test(out) || !/[א-ת]/.test(out)) return null;
  return out;
}

export function negationExercises(sentences, { recentLessonId = null } = {}) {
  const out = [];
  for (const s of Array.isArray(sentences) ? sentences : []) {
    if (!s || typeof s.he !== "string") continue;
    const prompt = affirmativeOf(s.he);
    if (!prompt) continue;
    const hasYesh = /(^|[\s,("'«])יש(?=$|[\s.,!?;:)"'»])/.test(prompt) && !/(^|[\s,("'«])יש(?=$|[\s.,!?;:)"'»])/.test(bare(s.he));
    out.push({
      kind: "negation",
      wordId: null,
      sentenceId: s.id,
      term: "",
      prompt,
      translation: String(s.ru ?? ""),
      label: "отрицание",
      hint: hasYesh ? "замени «יש» на «אין»" : "добавь «לא»",
      formId: "negation",
      answer: String(s.he).trim(),
      answerVocalized: s.heVocalized || "",
      audioUrl: s.audioUrl || "",
      recent: s.lessonId != null && s.lessonId === recentLessonId,
      wrong: Number(s.wrongCount ?? 0) > 0,
    });
  }
  return out;
}
