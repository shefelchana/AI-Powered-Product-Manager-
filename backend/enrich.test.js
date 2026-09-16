import "./env-for-tests.js";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { sequelize } from "./db.js";
import { migrate } from "./migrate.js";
import { Word, Example, Lesson, Sentence } from "./models.js";
import { linkLesson, linkWord } from "./enrich.js";
import { loadWord, presentWord } from "./present.js";
import { deleteLesson } from "./lessons.js";

before(async () => { await migrate(sequelize); });

const forms = JSON.stringify({ "INF-L": { bare: "להפר" }, "PERF-3ms": { bare: "הפר" }, "AP-fs": { bare: "מפרה" } });

test("фразы урока связываются со словами по формам; повторный запуск ничего не дублирует", async () => {
  const lesson = await Lesson.create({ date: "2026-09-14", title: "домашка" });
  const verb = await Word.create({ term: "להפר", translation: "нарушить", forms, lessonId: lesson.id });
  await Word.create({ term: "דממה", translation: "тишина" });
  const s1 = await Sentence.create({ lessonId: lesson.id, he: "היא מפרה את הדממה.", heVocalized: "הִיא מְפֵרָה אֶת הַדְּמָמָה.", ru: "Она нарушает тишину.", audioUrl: "a1.mp3" });
  await Sentence.create({ lessonId: lesson.id, he: "צריך לצמצם הוצאות.", ru: "Нужно сократить расходы.", audioUrl: "a2.mp3" });
  const first = await linkLesson(lesson.id);
  assert.equal(first.linked, 2);            // להפר ← מפרה, דממה ← הדממה
  const again = await linkLesson(lesson.id);
  assert.equal(again.linked, 0);
  const rows = await Example.findAll({ where: { wordId: verb.id } });
  assert.deepEqual(rows.map((r) => [r.origin, r.sentenceId, r.matched, r.text]), [["lesson", s1.id, "מפרה", "היא מפרה את הדממה."]]);
});

test("слово наружу: фраза урока с аудио, огласовками, переводом и найденной формой", async () => {
  const verb = await Word.findOne({ where: { term: "להפר" } });
  const plain = presentWord(await loadWord(verb.id));
  const ex = plain.exampleList.find((e) => e.sentenceId);
  assert.equal(ex.audioUrl, "a1.mp3");
  assert.equal(ex.vocalized, "הִיא מְפֵרָה אֶת הַדְּמָמָה.");
  assert.equal(ex.ru, "Она нарушает тишину.");
  assert.equal(ex.matched, "מפרה");
  assert.equal(plain.examples, "היא מפרה את הדממה.");
});

test("новое слово получает фразы из всех уже импортированных уроков", async () => {
  const word = await Word.create({ term: "לצמצם", translation: "сокращать", forms: JSON.stringify({ "INF-L": { bare: "לצמצם" } }) });
  const res = await linkWord(word.id);
  assert.equal(res.linked, 1);
  assert.equal((await Example.count({ where: { wordId: word.id, origin: "lesson" } })), 1);
});

test("удаление урока: ссылка на предложение обнуляется, текст фразы остаётся", async () => {
  const lesson = await Lesson.create({ date: "2026-09-16", title: "класс" });
  const word = await Word.create({ term: "סכסוך", translation: "конфликт" });
  await Sentence.create({ lessonId: lesson.id, he: "יש ביניהם סכסוך.", ru: "Между ними конфликт.", audioUrl: "a3.mp3" });
  await linkLesson(lesson.id);
  await deleteLesson(lesson.id);
  const [row] = await Example.findAll({ where: { wordId: word.id } });
  assert.equal(row.text, "יש ביניהם סכסוך.");
  assert.equal(row.sentenceId, null);
  const plain = presentWord(await loadWord(word.id));
  assert.equal(plain.exampleList[0].audioUrl, "");
});

test("фраза, уже записанная текстом (из описания задания), не дублируется — получает аудио и форму", async () => {
  const lesson = await Lesson.create({ date: "2026-09-17", title: "домашка" });
  const word = await Word.create({ term: "להעניק", translation: "предоставлять", forms: JSON.stringify({ "INF-L": { bare: "להעניק" }, "PERF-3ms": { bare: "העניק" } }) });
  await Example.create({ wordId: word.id, text: "זה העניק משמעות חדשה לחיים שלי.", origin: "lesson", lessonId: lesson.id });
  const s = await Sentence.create({ lessonId: lesson.id, he: "זה העניק משמעות חדשה לחיים שלי.", ru: "Это придало новый смысл моей жизни.", audioUrl: "a9.mp3" });
  const res = await linkLesson(lesson.id);
  assert.equal(res.linked, 1);
  const rows = await Example.findAll({ where: { wordId: word.id } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sentenceId, s.id);
  assert.equal(rows[0].matched, "העניק");
});
