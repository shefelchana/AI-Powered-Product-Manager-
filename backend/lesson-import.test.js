// Импорт разбора урока тройками: слово · значение преподавателя · фраза.
// Сначала кандидаты (ничего не пишется), потом человек ставит галочки,
// потом запись. Знакомые слова получают фразу и заметку, словарное
// значение не перезаписывается.
import "./env-for-tests.js";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { sequelize } from "./db.js";
import { migrate } from "./migrate.js";
import { Word, Example, Lesson, Sentence } from "./models.js";
import { lessonCandidates, applyLessonImport, parseLessonJson } from "./lesson-import.js";

before(async () => {
  await migrate(sequelize);
});

const analysis = {
  lesson: { date: "2026-09-07", title: "глаголы" },
  items: [
    { term: "לְצַמְצֵם", meaning: "сокращать, уменьшать", example: "לצמצם הוצאות", timestamp: "43:10", introducedBy: "teacher" },
    { term: "מענק", meaning: "грант", example: "", timestamp: "27:35", introducedBy: "teacher" },
    { term: "", meaning: "мусор без слова", example: "", timestamp: "" },
  ],
  corrections: [{ said: "אני לא שולטת על המצב", corrected: "אני לא שולטת במצב", kind: "предлог", timestamp: "24:38" }],
  phrases: [{ text: "בסופו של דבר", meaning: "в конце концов", timestamp: "11:20" }],
};

test("parseLessonJson принимает строку или объект, отбрасывает мусор и ограничивает размер", () => {
  const doc = parseLessonJson(JSON.stringify(analysis));
  assert.equal(doc.items.length, 2, "пустой term выброшен");
  assert.equal(doc.items[0].term, "לצמצם", "огласовки сняты");
  assert.equal(doc.lesson.date, "2026-09-07");
  assert.throws(() => parseLessonJson("{не json"), /JSON/);
  assert.throws(() => parseLessonJson({ items: "нет" }), /items/);
  const big = { lesson: {}, items: Array.from({ length: 600 }, (_, i) => ({ term: "מילה" + i })) };
  assert.equal(parseLessonJson(big).items.length, 500, "не больше 500 кандидатов за раз");
});

test("кандидаты: знакомое слово помечено, у него видно, чего не хватает; исправления и фразы — тоже кандидаты", async () => {
  const known = await Word.create({ term: "מענק", translation: "грант", definition: "grant", definitionSource: "pealim" });
  const doc = parseLessonJson(analysis);
  const candidates = await lessonCandidates(doc);
  const byTerm = Object.fromEntries(candidates.map((c) => [c.term, c]));
  assert.equal(byTerm["לצמצם"].exists, false);
  assert.equal(byTerm["מענק"].exists, true);
  assert.equal(byTerm["מענק"].wordId, known.id);
  assert.equal(byTerm["מענק"].hasDefinition, true);
  assert.equal(byTerm["מענק"].hasExample, false);
  assert.equal(byTerm["אני לא שולטת במצב"].kind, "correction");
  assert.match(byTerm["אני לא שולטת במצב"].meaning, /שולטת על/);
  assert.equal(byTerm["בסופו של דבר"].kind, "phrase");
  assert.equal(byTerm["בסופו של דבר"].meaning, "в конце концов");
});

test("запись: новое слово с переводом и фразой урока, знакомое — только фраза и заметка, урок создаётся один раз", async () => {
  const doc = parseLessonJson(analysis);
  const picks = (await lessonCandidates(doc)).filter((c) => ["לצמצם", "מענק"].includes(c.term));
  const result = await applyLessonImport(doc.lesson, picks);
  assert.equal(result.added, 1);
  assert.equal(result.updated, 1);
  const lesson = await Lesson.findByPk(result.lessonId);
  assert.equal(lesson.date, "2026-09-07");
  assert.ok(lesson.importedAt);

  const fresh = await Word.findOne({ where: { term: "לצמצם" } });
  assert.equal(fresh.translation, "сокращать, уменьшать", "русское значение преподавателя идёт в перевод");
  assert.equal(fresh.lessonNote, "сокращать, уменьшать");
  assert.equal(fresh.lessonId, lesson.id);
  assert.equal(fresh.definition, "", "объяснение не выдумывается");
  const ex = await Example.findAll({ where: { wordId: fresh.id } });
  assert.deepEqual(ex.map((e) => [e.text, e.origin, e.lessonId, e.timestamp]), [["לצמצם הוצאות", "lesson", lesson.id, "43:10"]]);

  const known = await Word.findOne({ where: { term: "מענק" } });
  assert.equal(known.definition, "grant", "словарное значение не перезаписано");
  assert.equal(known.definitionSource, "pealim");
  assert.equal(known.translation, "грант", "свой перевод не перезаписан");
  assert.equal(known.lessonNote, "грант");
  assert.equal(await Example.count({ where: { wordId: known.id } }), 0, "пустая фраза не пишется");

  // Повторный импорт того же — ни второго урока, ни второй фразы, ни второго слова.
  const again = await applyLessonImport(doc.lesson, picks);
  assert.equal(again.lessonId, lesson.id);
  assert.equal(await Lesson.count({ where: { date: "2026-09-07" } }), 1);
  assert.equal(await Word.count({ where: { term: "לצמצם" } }), 1);
  assert.equal(await Example.count({ where: { wordId: fresh.id } }), 1);
});

test("английское значение без перевода идёт в объяснение с подписью урока", async () => {
  const doc = parseLessonJson({ lesson: { date: "2026-09-08" }, items: [{ term: "לשרוד", meaning: "to survive", example: "", timestamp: "03:59" }] });
  await applyLessonImport(doc.lesson, await lessonCandidates(doc));
  const w = await Word.findOne({ where: { term: "לשרוד" } });
  assert.equal(w.definition, "to survive");
  assert.equal(w.definitionSource, "lesson");
  assert.match(w.sourceLabel, /преподаватель · урок 08\.09/);
  assert.equal(w.translation, "");
});

test("выбор без единого кандидата — ошибка, урок не создаётся", async () => {
  await assert.rejects(() => applyLessonImport({ date: "2026-09-09" }, []), /нечего/);
  assert.equal(await Lesson.count({ where: { date: "2026-09-09" } }), 0);
});

test("ответ ученицы с сайта и отмеченное слово сохраняются; повторный импорт дописывает их в уже известное предложение", async () => {
  const doc = { lesson: { date: "2026-09-16", title: "домашка", source: "hebreway", sourceId: "task-1" }, items: [],
    sentences: [{ sourceId: "s1", he: "זה העניק משמעות חדשה לחיים שלי.", ru: "Это придало новый смысл.", myMistake: null }] };
  const first = parseLessonJson(doc);
  await applyLessonImport(first.lesson, [], first.sentences);
  let row = await Sentence.findOne({ where: { sourceId: "s1" } });
  assert.equal(row.myAnswer, ""); assert.equal(row.wrongCount, 0);
  doc.sentences[0].myMistake = { answer: "זה ההניק משמעות חדשה לחיים שלי", mistakes: "העניק", hints: 0 };
  const second = parseLessonJson(doc);
  assert.equal(second.sentences[0].myAnswer, "זה ההניק משמעות חדשה לחיים שלי");
  assert.equal(second.sentences[0].siteMistakes, "העניק");
  const res = await applyLessonImport(second.lesson, [], second.sentences);
  assert.equal(res.sentences, 0);
  row = await Sentence.findOne({ where: { sourceId: "s1" } });
  assert.equal(row.myAnswer, "זה ההניק משמעות חדשה לחיים שלי");
  assert.equal(row.siteMistakes, "העניק");
  assert.equal(row.wrongCount, 1);
});
