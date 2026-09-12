// Примеры живут в своей таблице с происхождением; наружу слово по-прежнему
// отдаёт examples строкой (фронтенд и recall.js это читают), плюс exampleList.
import "./test-env.js";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { sequelize } from "./db.js";
import { migrate } from "./migrate.js";
import { Word, Example, Lesson } from "./models.js";
import { presentWord, addExampleTo, loadWord } from "./present.js";

before(async () => {
  await migrate(sequelize);
});

test("добавленный пример становится строкой Examples с origin own", async () => {
  const word = await Word.create({ term: "לצמצם", translation: "сокращать" });
  await addExampleTo(word, "לצמצם הוצאות");
  await addExampleTo(word, "  התקציב הצטמצם  ");
  const rows = await Example.findAll({ where: { wordId: word.id }, order: [["id", "ASC"]] });
  assert.deepEqual(rows.map((r) => [r.text, r.origin]), [["לצמצם הוצאות", "own"], ["התקציב הצטמצם", "own"]]);
});

test("слово наружу: examples строкой по порядку, exampleList с происхождением, без байтов картинки", async () => {
  const lesson = await Lesson.create({ date: "2026-09-07", title: "урок" });
  const word = await Word.create({ term: "מענק", lessonId: lesson.id, imageData: Buffer.from("png"), imageMime: "image/png" });
  await addExampleTo(word, "קיבלתי מענק");
  await Example.create({ wordId: word.id, text: "מענק מחקר", origin: "lesson", lessonId: lesson.id, timestamp: "27:35" });
  const plain = presentWord(await loadWord(word.id));
  assert.equal(plain.examples, "קיבלתי מענק\nמענק מחקר");
  assert.deepEqual(plain.exampleList.map((e) => [e.text, e.origin, e.timestamp]), [["קיבלתי מענק", "own", ""], ["מענק מחקר", "lesson", "27:35"]]);
  assert.equal(plain.hasImage, true);
  assert.equal(plain.imageData, undefined);
  assert.equal(plain.exampleRows, undefined);
  assert.equal(plain.lessonId, lesson.id);
});

test("слово без примеров отдаёт пустую строку и пустой список", async () => {
  const word = await Word.create({ term: "ריב" });
  const plain = presentWord(await loadWord(word.id));
  assert.equal(plain.examples, "");
  assert.deepEqual(plain.exampleList, []);
});

test("удаление слова уносит его примеры", async () => {
  const word = await Word.create({ term: "לשרוד" });
  await addExampleTo(word, "שרדתי בקושי");
  await word.destroy();
  assert.equal(await Example.count({ where: { wordId: word.id } }), 0);
});

test("пустой пример не записывается", async () => {
  const word = await Word.create({ term: "לגרש" });
  await assert.rejects(() => addExampleTo(word, "   "), /пуст/);
  assert.equal(await Example.count({ where: { wordId: word.id } }), 0);
});
