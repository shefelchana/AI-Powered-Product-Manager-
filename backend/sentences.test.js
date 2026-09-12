// Предложения урока с сайта ульпана: русское → эталонный иврит + аудио.
// Приходят в том же JSON разбора (поле sentences), хранятся отдельно от слов
// и идут в практику как упражнение «предложение».
import "./env-for-tests.js";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { sequelize } from "./db.js";
import { migrate } from "./migrate.js";
import { Sentence, Lesson } from "./models.js";
import { parseLessonJson, applyLessonImport, lessonCandidates } from "./lesson-import.js";
import { buildExercises } from "./practice.js";

before(async () => { await migrate(sequelize); });

const doc = {
  lesson: { date: "2026-09-09", title: "Домашняя работа 09.09 · Hebreway" },
  items: [{ term: "סכסוך", meaning: "", example: "יש ביניהם סכסוך" }],
  sentences: [
    { sourceId: "s1", he: "הם מסוכסכים אחד עם השני.", ru: "Они конфликтующие друг с другом.", en: "They are at odds.", audio: "s1.mp3", index: 1, myMistake: { answer: "הם מסוכסכים אחד עם נשני.", mistakes: "השני" } },
    { sourceId: "s2", he: "היא כעסה וצעקה עליי.", ru: "Она злилась и кричала на меня.", audio: "", index: 2, myMistake: null },
    { sourceId: "s3", he: "", ru: "пусто", audio: "", index: 3 },
  ],
};

test("parseLessonJson принимает предложения, отбрасывает пустые, снимает огласовки", () => {
  const parsed = parseLessonJson({ ...doc, sentences: [...doc.sentences, { sourceId: "s4", he: "שָׁלוֹם", ru: "привет" }] });
  assert.equal(parsed.sentences.length, 3);
  assert.equal(parsed.sentences[2].he, "שלום");
  assert.equal(parsed.sentences[0].wrong, true);
  assert.equal(parsed.sentences[1].wrong, false);
});

test("импорт записывает предложения к уроку один раз, повтор не дублирует, ошибка помечается", async () => {
  const parsed = parseLessonJson(doc);
  const picks = await lessonCandidates(parsed);
  const result = await applyLessonImport(parsed.lesson, picks, parsed.sentences);
  assert.equal(result.sentences, 2);
  const rows = await Sentence.findAll({ where: { lessonId: result.lessonId }, order: [["id", "ASC"]] });
  assert.deepEqual(rows.map((r) => [r.sourceId, r.wrongCount, r.audioUrl]), [["s1", 1, "s1.mp3"], ["s2", 0, ""]]);
  await applyLessonImport(parsed.lesson, picks, parsed.sentences);
  assert.equal(await Sentence.count({ where: { lessonId: result.lessonId } }), 2);
});

test("две работы в один день — два разных урока, если у них разные адреса", async () => {
  const a = parseLessonJson({ lesson: { date: "2026-09-11", title: "Домашняя", recordingUrl: "https://hebreway.com/t/aaa" }, items: [], sentences: [{ sourceId: "h1", he: "שלום", ru: "привет" }] });
  const b = parseLessonJson({ lesson: { date: "2026-09-11", title: "Классная", recordingUrl: "https://hebreway.com/t/bbb" }, items: [], sentences: [{ sourceId: "c1", he: "ביי", ru: "пока" }] });
  const ra = await applyLessonImport(a.lesson, [], a.sentences);
  const rb = await applyLessonImport(b.lesson, [], b.sentences);
  assert.notEqual(ra.lessonId, rb.lessonId);
  assert.equal(await Lesson.count({ where: { date: "2026-09-11" } }), 2);
});

test("практика: предложение — вопрос по-русски, ответ эталон, аудио; ошибочные идут первыми", async () => {
  const lesson = await Lesson.findOne({ where: { date: "2026-09-09" } });
  const sentences = await Sentence.findAll({ where: { lessonId: lesson.id } });
  const list = buildExercises([], { limit: 10, rng: () => 0.3, recentLessonId: lesson.id, sentences });
  assert.equal(list.length, 2);
  assert.equal(list[0].kind, "sentence");
  assert.equal(list[0].answer, "הם מסוכסכים אחד עם השני.");
  assert.equal(list[0].prompt, "Они конфликтующие друг с другом.");
  assert.equal(list[0].audioUrl, "s1.mp3");
  assert.equal(list[0].sentenceId, sentences.find((s) => s.sourceId === "s1").id);
});

test("импорт без предложений работает как раньше", async () => {
  const parsed = parseLessonJson({ lesson: { date: "2026-09-10" }, items: [{ term: "ריב" }] });
  assert.deepEqual(parsed.sentences, []);
  const r = await applyLessonImport(parsed.lesson, await lessonCandidates(parsed), parsed.sentences);
  assert.equal(r.sentences, 0);
});
