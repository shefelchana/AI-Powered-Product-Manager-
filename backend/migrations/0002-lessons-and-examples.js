// Урок становится сущностью, примеры — строками с происхождением.
// Старая колонка Words.examples остаётся нетронутой: её никто больше не читает
// и не пишет, но откат должен быть возможен. Уберёт отдельная миграция позже.
import { DataTypes } from "sequelize";
import { hasTable, hasColumn } from "../migrate.js";

const STAMPS = {
  createdAt: { type: DataTypes.DATE, allowNull: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false },
};

export async function up({ context: qi, transaction }) {
  if (!(await hasTable(qi, "Lessons", transaction))) await qi.createTable("Lessons", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
    recordingUrl: { type: DataTypes.STRING(2048), allowNull: false, defaultValue: "" },
    transcriptPath: { type: DataTypes.STRING(500), allowNull: false, defaultValue: "" },
    importedAt: { type: DataTypes.DATE, allowNull: true },
    ...STAMPS,
  }, { transaction });

  if (!(await hasColumn(qi, "Words", "lessonId", transaction))) await qi.addColumn("Words", "lessonId", {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: "Lessons", key: "id" },
    onDelete: "SET NULL",
  }, { transaction });

  const hadExamples = await hasTable(qi, "Examples", transaction);
  if (!hadExamples) await qi.createTable("Examples", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    wordId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Words", key: "id" },
      onDelete: "CASCADE",
    },
    text: { type: DataTypes.TEXT, allowNull: false },
    // own — своя фраза; lesson — из урока; dictionary — из словаря.
    origin: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "own" },
    lessonId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Lessons", key: "id" },
      onDelete: "SET NULL",
    },
    timestamp: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "" },
    ...STAMPS,
  }, { transaction });

  // Перенос: каждая непустая строка старого поля — своя фраза. Только при
  // первом проходе: если таблица уже была, перенос уже случился.
  if (hadExamples) return;
  const [rows] = await qi.sequelize.query('SELECT "id", "examples" FROM "Words"', { transaction });
  const now = new Date();
  const inserts = [];
  for (const row of rows) {
    for (const line of String(row.examples ?? "").split("\n")) {
      const text = line.trim();
      if (text) inserts.push({ wordId: row.id, text, origin: "own", lessonId: null, timestamp: "", createdAt: now, updatedAt: now });
    }
  }
  if (inserts.length > 0) await qi.bulkInsert("Examples", inserts, { transaction });
}

export async function down({ context: qi, transaction }) {
  // Откат переливает фразы обратно в текстовую колонку, иначе всё, что
  // добавили после миграции, пропало бы.
  const [rows] = await qi.sequelize.query('SELECT "wordId", "text" FROM "Examples" ORDER BY "id"', { transaction });
  const byWord = new Map();
  for (const row of rows) byWord.set(row.wordId, [...(byWord.get(row.wordId) ?? []), row.text]);
  for (const [wordId, texts] of byWord) {
    await qi.sequelize.query('UPDATE "Words" SET "examples" = :examples WHERE "id" = :id', {
      replacements: { examples: texts.join("\n"), id: wordId }, transaction,
    });
  }
  await qi.dropTable("Examples", { transaction });
  await qi.removeColumn("Words", "lessonId", { transaction });
  await qi.dropTable("Lessons", { transaction });
}
