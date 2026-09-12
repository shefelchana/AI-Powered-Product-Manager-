// Урок на входе: «Начать урок» открывает урок, всё добавленное до
// «Закончить урок» привязано к нему. Второй «Начать» не плодит уроков.
import "./env-for-tests.js";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { sequelize } from "./db.js";
import { migrate } from "./migrate.js";
import { Word, Lesson } from "./models.js";
import { startLesson, currentLesson, finishLesson } from "./lessons.js";
import { presentWord, loadWord } from "./present.js";

before(async () => {
  await migrate(sequelize);
});

test("начать урок: создаётся один открытый урок с сегодняшней датой", async () => {
  const lesson = await startLesson({});
  assert.equal(lesson.finishedAt, null);
  assert.match(lesson.date, /^\d{4}-\d{2}-\d{2}$/);
  const current = await currentLesson();
  assert.equal(current.id, lesson.id);
});

test("повторное «начать», пока урок идёт, возвращает тот же урок", async () => {
  const first = await currentLesson();
  const again = await startLesson({ title: "ещё раз" });
  assert.equal(again.id, first.id);
  assert.equal(await Lesson.count(), 1);
});

test("закончить урок: текущего больше нет, следующий «начать» открывает новый", async () => {
  const open = await currentLesson();
  const finished = await finishLesson(open.id);
  assert.ok(finished.finishedAt instanceof Date);
  assert.equal(await currentLesson(), null);
  const next = await startLesson({ title: "урок 2" });
  assert.notEqual(next.id, open.id);
  assert.equal(next.title, "урок 2");
});

test("закончить несуществующий или уже закрытый урок — ошибка, не тишина", async () => {
  await assert.rejects(() => finishLesson(9999), /не найден/);
  const open = await currentLesson();
  await finishLesson(open.id);
  await assert.rejects(() => finishLesson(open.id), /уже закончен/);
});

test("слово с флажком «?» и уроком уходит наружу с этими полями", async () => {
  const lesson = await startLesson({});
  const word = await Word.create({ term: "להעניק", lessonId: lesson.id, question: true });
  const plain = presentWord(await loadWord(word.id));
  assert.equal(plain.lessonId, lesson.id);
  assert.equal(plain.question, true);
  const plainDefault = presentWord(await loadWord((await Word.create({ term: "ריב" })).id));
  assert.equal(plainDefault.question, false);
});

// Пустой урок (случайно нажатое «Начать урок») можно удалить; урок со словами
// или предложениями — нет: сначала их надо перенести или удалить.
import { deleteLesson } from "./lessons.js";
import { Sentence } from "./models.js";

test("пустой урок удаляется, урок со словами или предложениями — нет", async () => {
  const empty = await Lesson.create({ date: "2026-09-12", finishedAt: new Date() });
  await deleteLesson(empty.id);
  assert.equal(await Lesson.findByPk(empty.id), null);

  const withWord = await Lesson.create({ date: "2026-09-13", finishedAt: new Date() });
  await Word.create({ term: "לאגן", lessonId: withWord.id });
  await assert.rejects(() => deleteLesson(withWord.id), /слов/);

  const withSentence = await Lesson.create({ date: "2026-09-14", finishedAt: new Date() });
  await Sentence.create({ lessonId: withSentence.id, he: "שלום", ru: "привет" });
  await assert.rejects(() => deleteLesson(withSentence.id), /предложен/);
  await assert.rejects(() => deleteLesson(999999), /не найден/);
});
