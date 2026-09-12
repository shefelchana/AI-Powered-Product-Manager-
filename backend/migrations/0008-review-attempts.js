// Журнал ответов на повторении: без него нельзя посчитать удержание и точность
// по неделям — приложение помнило бы только текущую коробку.
import { DataTypes } from "sequelize";
import { hasTable } from "../migrate.js";

export async function up({ context: qi, transaction }) {
  if (await hasTable(qi, "ReviewAttempts", transaction)) return;
  await qi.createTable("ReviewAttempts", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    wordId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "Words", key: "id" }, onDelete: "CASCADE" },
    known: { type: DataTypes.BOOLEAN, allowNull: false },
    mode: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "" },
    boxBefore: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    boxAfter: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  }, { transaction });
}

export async function down({ context: qi, transaction }) {
  await qi.dropTable("ReviewAttempts", { transaction });
}
