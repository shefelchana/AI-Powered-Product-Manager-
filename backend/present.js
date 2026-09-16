// Как слово уходит наружу и как к нему добавляется пример.
// Вынесено из server.js, чтобы гоняться тестами без поднятия сервера.
import { Word, Example } from "./models.js";

const MAX_EXAMPLE = 1000;

// Картинка хранится байтами; в списках она не нужна и раздувает ответ.
// Примеры — строкой по порядку (это читают recall.js и экран повторения)
// и списком с происхождением (это читает всё новое).
export function presentWord(word) {
  const plain = word.toJSON();
  // Порядок — по id: порядок include не гарантирован, а фразы должны идти как записаны.
  const rows = [...(plain.exampleRows ?? [])].sort((a, b) => a.id - b.id);
  plain.exampleList = rows.map(({ id, text, origin, lessonId, timestamp, sentenceId, matched, sentenceRef }) => ({
    id, text, origin, lessonId, timestamp,
    sentenceId: sentenceId ?? null,
    matched: matched || "",
    audioUrl: sentenceRef?.audioUrl || "",
    vocalized: sentenceRef?.heVocalized || "",
    ru: sentenceRef?.ru || "",
  }));
  plain.examples = rows.map((row) => row.text).join("\n");
  delete plain.exampleRows;
  plain.hasImage = Boolean(plain.imageData);
  delete plain.imageData;
  return plain;
}

// Слово с примерами — для ответа после изменения: у экземпляра из
// findByPk примеры уже есть, но после записи их надо перечитать.
export function loadWord(id) {
  return Word.findByPk(id);
}

export async function addExampleTo(word, text, extra = {}) {
  const clean = typeof text === "string" ? text.trim().slice(0, MAX_EXAMPLE) : "";
  if (!clean) throw new Error("Пример не может быть пустым");
  return Example.create({ wordId: word.id, text: clean, origin: "own", lessonId: null, timestamp: "", ...extra });
}
