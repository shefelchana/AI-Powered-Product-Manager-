// Урок становится сущностью, примеры — строками с происхождением.
// Старая колонка Words.examples остаётся нетронутой: её никто больше не читает
// и не пишет, но откат должен быть возможен. Уберёт отдельная миграция позже.
import { DataTypes } from "sequelize";

const STAMPS = {
  createdAt: { type: DataTypes.DATE, allowNull: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false },
};

export async function up({ context: qi, transaction }) {
  await qi.createTable("Lessons", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
    recordingUrl: { type: DataTypes.STRING(2048), allowNull: false, defaultValue: "" },
    transcriptPath: { type: DataTypes.STRING(500), allowNull: false, defaultValue: "" },
    importedAt: { type: DataTypes.DATE, allowNull: true },
    ...STAMPS,
  }, { transaction });

  await qi.addColumn("Words", "lessonId", {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: "Lessons", key: "id" },
    onDelete: "SET NULL",
  }, { transaction });

  await qi.createTable("Examples", {
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

  // Перенос: каждая непустая строка старого поля — своя фраза.
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
  await qi.dropTable("Examples", { transaction });
  await qi.removeColumn("Words", "lessonId", { transaction });
  await qi.dropTable("Lessons", { transaction });
}
