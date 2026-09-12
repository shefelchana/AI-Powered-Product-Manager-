import { test } from "node:test";
import assert from "node:assert/strict";
import { Sequelize, DataTypes } from "sequelize";
import { migrate, pendingMigrations } from "./migrate.js";

// Миграции гоняются на той же базе, что и прод (SQLite здесь, Postgres там),
// тем же кодом: тест проверяет ровно тот путь, которым схема доезжает при старте.

const fresh = () => new Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false });

test("на пустой базе появляются Words, Lessons, Examples и колонка lessonId", async () => {
  const db = fresh();
  await migrate(db);
  const qi = db.getQueryInterface();
  const tables = await qi.showAllTables();
  for (const name of ["Words", "Lessons", "Examples", "SchemaMigrations"]) {
    assert.ok(tables.includes(name), `нет таблицы ${name}: ${tables}`);
  }
  const words = await qi.describeTable("Words");
  assert.ok(words.lessonId, "у Words нет lessonId");
  assert.ok(words.examples, "старая колонка examples должна остаться до уборки");
  const examples = await qi.describeTable("Examples");
  assert.deepEqual(Object.keys(examples).sort(), ["createdAt", "id", "lessonId", "origin", "text", "timestamp", "updatedAt", "wordId"]);
});

// База, какой её оставил sync({ alter: true }) до появления миграций:
// одна таблица Words, примеры — текстом по строке, никакого журнала миграций.
async function legacyDatabase() {
  const db = fresh();
  const qi = db.getQueryInterface();
  await qi.createTable("Words", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    term: { type: DataTypes.STRING(200), allowNull: false },
    definition: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    definitionSource: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "" },
    translation: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
    examples: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    lang: { type: DataTypes.STRING(2), allowNull: false, defaultValue: "he" },
    box: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    nextDue: { type: DataTypes.DATEONLY, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  const now = new Date();
  await qi.bulkInsert("Words", [
    { term: "לצמצם", definition: "", definitionSource: "", translation: "сокращать", examples: "לצמצם הוצאות\nהתקציב הצטמצם", lang: "he", box: 2, nextDue: "2026-09-12", createdAt: now, updatedAt: now },
    { term: "מענק", definition: "", definitionSource: "", translation: "грант", examples: "", lang: "he", box: 1, nextDue: "2026-09-12", createdAt: now, updatedAt: now },
  ]);
  return db;
}

test("старая база: примеры переезжают строками, слова целы, недостающие колонки добавляются", async () => {
  const db = await legacyDatabase();
  await migrate(db);
  const [words] = await db.query("SELECT id, term, translation, box, lessonId FROM Words ORDER BY id");
  assert.equal(words.length, 2);
  assert.equal(words[0].term, "לצמצם");
  assert.equal(words[0].box, 2);
  assert.equal(words[0].lessonId, null);
  const [examples] = await db.query("SELECT wordId, text, origin, lessonId FROM Examples ORDER BY id");
  assert.deepEqual(examples, [
    { wordId: words[0].id, text: "לצמצם הוצאות", origin: "own", lessonId: null },
    { wordId: words[0].id, text: "התקציב הצטמצם", origin: "own", lessonId: null },
  ]);
  // Колонки, которых в старой базе не было (root, imageMime, …), появились с дефолтами.
  const shape = await db.getQueryInterface().describeTable("Words");
  for (const column of ["root", "binyan", "imageUrl", "imageMime", "sourceLabel", "dayPickedAt", "lesson"]) {
    assert.ok(shape[column], `после baseline нет колонки ${column}`);
  }
});

test("повторный запуск ничего не делает и не дублирует примеры", async () => {
  const db = await legacyDatabase();
  await migrate(db);
  assert.deepEqual(await pendingMigrations(db), []);
  await migrate(db);
  const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM Examples");
  assert.equal(Number(n), 2);
});

test("пустой пример из старой базы не превращается в строку", async () => {
  const db = fresh();
  const qi = db.getQueryInterface();
  await qi.createTable("Words", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    term: { type: DataTypes.STRING(200), allowNull: false },
    examples: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    nextDue: { type: DataTypes.DATEONLY, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  const now = new Date();
  await qi.bulkInsert("Words", [{ term: "ריב", examples: "\n  \n", nextDue: "2026-09-12", createdAt: now, updatedAt: now }]);
  await migrate(db);
  const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM Examples");
  assert.equal(Number(n), 0);
});

test("0003: у урока появляется finishedAt, у слова — флажок question (по умолчанию снят)", async () => {
  const db = await legacyDatabase();
  await migrate(db);
  const qi = db.getQueryInterface();
  const lessons = await qi.describeTable("Lessons");
  assert.ok(lessons.finishedAt, "нет Lessons.finishedAt");
  const words = await qi.describeTable("Words");
  assert.ok(words.question, "нет Words.question");
  const [rows] = await db.query("SELECT question FROM Words");
  assert.ok(rows.every((r) => Number(r.question) === 0), "старые слова должны быть без флажка");
});

test("0004: у слова появляется lessonNote — значение словами преподавателя", async () => {
  const db = await legacyDatabase();
  await migrate(db);
  const words = await db.getQueryInterface().describeTable("Words");
  assert.ok(words.lessonNote, "нет Words.lessonNote");
  const [rows] = await db.query("SELECT lessonNote FROM Words");
  assert.ok(rows.every((r) => r.lessonNote === ""), "по умолчанию пусто");
});

// Журнал миграций пишется после транзакции миграции: обрыв между ними
// оставляет применённую, но незаписанную миграцию. Повторный старт обязан пройти.
test("миграция применена, но не записана в журнал — повторный запуск проходит, не падает", async () => {
  const db = await legacyDatabase();
  await migrate(db);
  await db.query("DELETE FROM SchemaMigrations WHERE name IN ('0002-lessons-and-examples.js', '0003-lesson-state-and-question.js', '0004-lesson-note.js')");
  await migrate(db);
  assert.deepEqual(await pendingMigrations(db), []);
  const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM Examples");
  assert.equal(Number(n), 2, "перенос примеров не повторяется");
});

test("база, где sync уже добавил lessonId, мигрирует без ошибки", async () => {
  const db = await legacyDatabase();
  await db.getQueryInterface().addColumn("Words", "lessonId", { type: DataTypes.INTEGER, allowNull: true });
  await migrate(db);
  assert.deepEqual(await pendingMigrations(db), []);
});

test("0005: у слова есть forms, есть таблица PracticeAttempts", async () => {
  const db = await legacyDatabase();
  await migrate(db);
  const qi = db.getQueryInterface();
  assert.ok((await qi.describeTable("Words")).forms);
  assert.ok((await qi.showAllTables()).includes("PracticeAttempts"));
});

test("0006: таблица Sentences для предложений урока", async () => {
  const db = await legacyDatabase();
  await migrate(db);
  const qi = db.getQueryInterface();
  assert.ok((await qi.showAllTables()).includes("Sentences"));
  const cols = await qi.describeTable("Sentences");
  for (const c of ["lessonId", "he", "ru", "audioUrl", "sourceId", "wrongCount"]) assert.ok(cols[c], `нет колонки ${c}`);
});

test("0007: у слова есть счётчик промахов misses, по умолчанию 0", async () => {
  const db = await legacyDatabase();
  await migrate(db);
  assert.ok((await db.getQueryInterface().describeTable("Words")).misses);
  const [rows] = await db.query("SELECT misses FROM Words");
  assert.ok(rows.every((r) => Number(r.misses) === 0));
});

test("0008: таблица ReviewAttempts", async () => {
  const db = await legacyDatabase();
  await migrate(db);
  assert.ok((await db.getQueryInterface().showAllTables()).includes("ReviewAttempts"));
});

test("0009: у слова есть dayReason, по умолчанию пусто", async () => {
  const db = await legacyDatabase();
  await migrate(db);
  assert.ok((await db.getQueryInterface().describeTable("Words")).dayReason);
});
