// Формы глагола (таблица Pealim, JSON) хранятся у слова; попытки в практике —
// своя таблица, по ней позже взвешиваются формы с промахами.
import { DataTypes } from "sequelize";
import { hasTable, hasColumn } from "../migrate.js";

export async function up({ context: qi, transaction }) {
  if (!(await hasColumn(qi, "Words", "forms", transaction))) {
    await qi.addColumn("Words", "forms", { type: DataTypes.TEXT, allowNull: false, defaultValue: "" }, { transaction });
  }
  if (!(await hasTable(qi, "PracticeAttempts", transaction))) {
    await qi.createTable("PracticeAttempts", {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      wordId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "Words", key: "id" }, onDelete: "CASCADE" },
      formId: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "" },
      ok: { type: DataTypes.BOOLEAN, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });
  }
}

export async function down({ context: qi, transaction }) {
  await qi.dropTable("PracticeAttempts", { transaction });
  await qi.removeColumn("Words", "forms", { transaction });
}
