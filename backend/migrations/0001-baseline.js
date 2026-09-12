// Точка отсчёта. На пустой базе создаёт Words такой, какой её знал models.js
// к 12.09.2026. На живой базе (прод, где таблицу годами догонял alter) —
// ничего не пересоздаёт: только добавляет колонки, которых не хватает.
// Это последний раз, когда схема «догоняется»; дальше — только миграции.
import { DataTypes } from "sequelize";

export const WORD_COLUMNS = {
  term: { type: DataTypes.STRING(200), allowNull: false },
  definition: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  definitionSource: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "" },
  sourceLabel: { type: DataTypes.STRING(300), allowNull: false, defaultValue: "" },
  sourceUrl: { type: DataTypes.STRING(300), allowNull: false, defaultValue: "" },
  translation: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
  root: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "" },
  binyan: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "" },
  imageUrl: { type: DataTypes.STRING(2048), allowNull: false, defaultValue: "" },
  imageData: { type: DataTypes.BLOB, allowNull: true },
  imageMime: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "" },
  examples: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  dayPickedAt: { type: DataTypes.DATEONLY, allowNull: true },
  lesson: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
  lang: { type: DataTypes.STRING(2), allowNull: false, defaultValue: "he" },
  box: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  nextDue: { type: DataTypes.DATEONLY, allowNull: false },
};

const STAMPS = {
  createdAt: { type: DataTypes.DATE, allowNull: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false },
};

export async function up({ context: qi, transaction }) {
  const tables = await qi.showAllTables({ transaction });
  if (!tables.includes("Words")) {
    await qi.createTable("Words", {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      ...WORD_COLUMNS,
      ...STAMPS,
    }, { transaction });
    return;
  }
  const shape = await qi.describeTable("Words", { transaction });
  for (const [name, definition] of Object.entries(WORD_COLUMNS)) {
    if (!shape[name]) await qi.addColumn("Words", name, definition, { transaction });
  }
}

export async function down() {
  // Точку отсчёта не откатываем: ниже неё ничего нет.
}
