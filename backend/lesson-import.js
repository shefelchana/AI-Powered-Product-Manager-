// Импорт разбора урока тройками: слово · значение преподавателя · фраза.
//
// Три шага, и только последний пишет:
//   parseLessonJson  — проверяет форму и чистит: снимает огласовки, режет мусор;
//   lessonCandidates — сверяет с колодой, ничего не создаёт;
//   applyLessonImport — записывает то, что человек отметил галочками.
//
// Правила записи (дизайн §3.2): словарное значение и свой перевод не
// перезаписываются; значение преподавателя всегда ложится в lessonNote;
// фраза из урока — строка Examples с origin "lesson" и таймкодом.
import { Op } from "sequelize";
import { Word, Example, Lesson, Sentence, detectLang, today } from "./models.js";

const MAX_ITEMS = 500;
const MAX_TEXT = 1000;
const NIQQUD = /[֑-ׇ]/g;

const str = (value, max = MAX_TEXT) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const hebrew = (value, max = 200) => str(value, max).replace(NIQQUD, "");
// Кандидат — только то, что написано ивритом: русские пояснения модели в термин не идут.
const isHebrew = (text) => /[א-ת]/.test(text);
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));
const cyrillic = (text) => /[Ѐ-ӿ]/.test(text);

export function parseLessonJson(input) {
  let raw = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch {
      throw new Error("Это не JSON: проверь, что вставлен весь файл разбора");
    }
  }
  if (!raw || typeof raw !== "object") throw new Error("Разбор урока должен быть объектом JSON");
  if (!Array.isArray(raw.items)) throw new Error("В разборе нет списка items");

  const lesson = raw.lesson && typeof raw.lesson === "object" ? raw.lesson : {};
  const items = raw.items
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      term: hebrew(item.term),
      meaning: str(item.meaning),
      example: hebrew(item.example, MAX_TEXT),
      timestamp: str(item.timestamp, 10),
      introducedBy: item.introducedBy === "student" ? "student" : "teacher",
    }))
    .filter((item) => item.term && isHebrew(item.term))
    .slice(0, MAX_ITEMS);
  const corrections = (Array.isArray(raw.corrections) ? raw.corrections : [])
    .filter((c) => c && typeof c === "object")
    .map((c) => ({ said: hebrew(c.said, MAX_TEXT), corrected: hebrew(c.corrected, MAX_TEXT), kind: str(c.kind, 40), timestamp: str(c.timestamp, 10) }))
    .filter((c) => c.corrected && isHebrew(c.corrected))
    .slice(0, MAX_ITEMS);
  const phrases = (Array.isArray(raw.phrases) ? raw.phrases : [])
    .filter((p) => p && typeof p === "object")
    .map((p) => ({ text: hebrew(p.text, MAX_TEXT), meaning: str(p.meaning), timestamp: str(p.timestamp, 10) }))
    .filter((p) => p.text && isHebrew(p.text))
    .slice(0, MAX_ITEMS);

  // Предложения урока (сайт ульпана): русское → эталонный иврит + аудио.
  const sentences = (Array.isArray(raw.sentences) ? raw.sentences : [])
    .filter((s) => s && typeof s === "object")
    .map((s, i) => ({
      sourceId: str(s.sourceId, 80),
      he: hebrew(s.he, MAX_TEXT),
      heVocalized: str(s.heVocalized, MAX_TEXT),
      ru: str(s.ru),
      en: str(s.en),
      audioUrl: str(s.audio ?? s.audioUrl, 300),
      position: Number.isInteger(s.index) ? s.index : i + 1,
      wrong: Boolean(s.myMistake),
    }))
    .filter((s) => s.he && isHebrew(s.he))
    .slice(0, MAX_ITEMS);

  return {
    lesson: {
      date: isDate(lesson.date) ? lesson.date : today(),
      title: str(lesson.title, 200),
      recordingUrl: str(lesson.recordingUrl, 2048),
    },
    items,
    corrections,
    phrases,
    sentences,
  };
}

// Кандидаты — всё из разбора, сверенное с колодой. Знакомое слово помечено,
// и видно, чего у него нет: значения, фразы. Решает человек.
export async function lessonCandidates(doc) {
  const wanted = [
    ...doc.items.map((i) => ({ term: i.term, meaning: i.meaning, example: i.example, timestamp: i.timestamp, kind: "word" })),
    ...doc.corrections.map((c) => ({
      term: c.corrected,
      meaning: `исправление${c.kind ? ` (${c.kind})` : ""}: было «${c.said}»`,
      example: "",
      timestamp: c.timestamp,
      kind: "correction",
    })),
    ...doc.phrases.map((p) => ({ term: p.text, meaning: p.meaning, example: "", timestamp: p.timestamp, kind: "phrase" })),
  ];
  // Одно и то же слово может прозвучать дважды: первое упоминание главнее.
  const seen = new Set();
  const unique = wanted.filter((c) => (seen.has(c.term) ? false : (seen.add(c.term), true)));

  const existing = await Word.findAll({ where: { term: { [Op.in]: unique.map((c) => c.term) } } });
  const byTerm = new Map(existing.map((w) => [w.term, w]));
  return unique.map((c) => {
    const word = byTerm.get(c.term);
    const hasExample = Boolean(word && c.example && (word.exampleRows ?? []).some((e) => e.text === c.example));
    return {
      ...c,
      exists: Boolean(word),
      wordId: word?.id ?? null,
      hasDefinition: Boolean(word && (word.definition || word.translation)),
      hasExample,
    };
  });
}

async function lessonFor(meta) {
  const date = isDate(meta?.date) ? meta.date : today();
  // Адрес задания — точнее даты: в один день бывают и классная, и домашняя.
  const url = str(meta?.recordingUrl, 2048);
  const found = url
    ? await Lesson.findOne({ where: { recordingUrl: url } })
    : await Lesson.findOne({ where: { date, recordingUrl: "" }, order: [["id", "DESC"]] });
  if (found) {
    if (!found.importedAt) {
      found.importedAt = new Date();
      if (!found.title && meta?.title) found.title = str(meta.title, 200);
      if (!found.recordingUrl && meta?.recordingUrl) found.recordingUrl = str(meta.recordingUrl, 2048);
      await found.save();
    }
    return found;
  }
  return Lesson.create({
    date,
    title: str(meta?.title, 200),
    recordingUrl: str(meta?.recordingUrl, 2048),
    importedAt: new Date(),
    finishedAt: new Date(),
  });
}

const sourceLabel = (lesson, timestamp) => {
  const [y, m, d] = String(lesson.date).split("-");
  return `преподаватель · урок ${d}.${m}${timestamp ? ` · ${timestamp}` : ""}`;
};

export async function applyLessonImport(meta, picks, sentences = []) {
  const chosen = (Array.isArray(picks) ? picks : [])
    .map((p) => ({ term: hebrew(p?.term), meaning: str(p?.meaning), example: hebrew(p?.example, MAX_TEXT), timestamp: str(p?.timestamp, 10) }))
    .filter((p) => p.term && isHebrew(p.term));
  const lines = (Array.isArray(sentences) ? sentences : []).filter((s) => s && isHebrew(String(s.he ?? "")));
  if (chosen.length === 0 && lines.length === 0) throw new Error("Импортировать нечего: ни одного отмеченного кандидата");

  const lesson = await lessonFor(meta);
  let added = 0;
  let updated = 0;

  for (const pick of chosen) {
    let word = await Word.findOne({ where: { term: pick.term } });
    const russian = cyrillic(pick.meaning);
    if (!word) {
      word = await Word.create({
        term: pick.term,
        lang: detectLang(pick.term),
        translation: russian ? pick.meaning.slice(0, 200) : "",
        definition: !russian && pick.meaning ? pick.meaning : "",
        definitionSource: !russian && pick.meaning ? "lesson" : "",
        sourceLabel: !russian && pick.meaning ? sourceLabel(lesson, pick.timestamp) : "",
        lessonNote: pick.meaning,
        lessonId: lesson.id,
        box: 1,
        nextDue: today(),
      });
      added += 1;
    } else {
      // Знакомое слово: дополняем, не переписываем.
      if (pick.meaning && !word.lessonNote) word.lessonNote = pick.meaning;
      if (russian && !word.translation) word.translation = pick.meaning.slice(0, 200);
      if (!russian && pick.meaning && !word.definition) {
        word.definition = pick.meaning;
        word.definitionSource = "lesson";
        word.sourceLabel = sourceLabel(lesson, pick.timestamp);
      }
      if (!word.lessonId) word.lessonId = lesson.id;
      await word.save();
      updated += 1;
    }
    if (pick.example) {
      const dup = await Example.findOne({ where: { wordId: word.id, text: pick.example } });
      if (!dup) await Example.create({ wordId: word.id, text: pick.example, origin: "lesson", lessonId: lesson.id, timestamp: pick.timestamp });
    }
  }

  // Предложения: по sourceId внутри урока, повтор не дублирует; ошибка с сайта — счётчик.
  let stored = 0;
  for (const s of lines) {
    const where = s.sourceId ? { lessonId: lesson.id, sourceId: str(s.sourceId, 80) } : { lessonId: lesson.id, he: hebrew(s.he, MAX_TEXT) };
    const existing = await Sentence.findOne({ where });
    if (existing) continue;
    await Sentence.create({
      lessonId: lesson.id,
      sourceId: str(s.sourceId, 80),
      he: hebrew(s.he, MAX_TEXT),
      heVocalized: str(s.heVocalized, MAX_TEXT),
      ru: str(s.ru),
      en: str(s.en),
      audioUrl: str(s.audioUrl ?? s.audio, 300),
      position: Number.isInteger(s.position) ? s.position : 0,
      wrongCount: s.wrong ? 1 : 0,
    });
    stored += 1;
  }

  return { lessonId: lesson.id, added, updated, sentences: stored };
}
