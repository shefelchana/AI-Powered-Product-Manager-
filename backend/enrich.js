// Сборка карточки после урока: фразы преподавателя → к словам (детерминированно, по формам Pealim).
// Пишем только связи, которых нет; текст фразы — предложение целиком. Отчёт — что связано и что отвергнуто.
import { Op } from "sequelize";
import { Example, Sentence, Word } from "./models.js";
import { sentencesFor } from "./link.js";

// Связать набор предложений с набором слов. Идемпотентно: пара (слово, предложение) — одна строка.
export async function linkSentences({ words, sentences, log = null }) {
  let linked = 0;
  const rejected = [];
  for (const word of words) {
    const { matches, rejected: rej } = sentencesFor(word, sentences, { withRejected: true });
    for (const r of rej) rejected.push({ wordId: word.id, term: word.term, ...r });
    for (const m of matches) {
      const dup = await Example.findOne({ where: { wordId: word.id, sentenceId: m.sentenceId } });
      if (dup) continue;
      const s = sentences.find((x) => x.id === m.sentenceId);
      await Example.create({ wordId: word.id, text: s.he, origin: "lesson", lessonId: s.lessonId, timestamp: "", sentenceId: s.id, matched: m.matched });
      linked += 1;
      log?.({ wordId: word.id, term: word.term, sentenceId: s.id, formId: m.formId, prefix: m.prefix, matched: m.matched });
    }
  }
  return { linked, rejected };
}

// После урока: его предложения — ко всем словам колоды.
export async function linkLesson(lessonId, opts = {}) {
  const sentences = (await Sentence.findAll({ where: { lessonId } })).map((s) => s.toJSON());
  const words = (await Word.unscoped().findAll({ where: { lang: "he" }, attributes: ["id", "term", "forms"] })).map((w) => w.toJSON());
  return linkSentences({ words, sentences, ...opts });
}

// Новое или изменённое слово: все предложения всех уроков — к нему.
export async function linkWord(wordId, opts = {}) {
  const word = await Word.unscoped().findByPk(wordId, { attributes: ["id", "term", "forms", "lang"] });
  if (!word || word.lang !== "he") return { linked: 0, rejected: [] };
  const sentences = (await Sentence.findAll({ where: { he: { [Op.ne]: "" } } })).map((s) => s.toJSON());
  return linkSentences({ words: [word.toJSON()], sentences, ...opts });
}
