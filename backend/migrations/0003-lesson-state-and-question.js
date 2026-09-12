// Урок можно закончить (finishedAt), у слова — флажок «?» («не поняла, спросить»).
import { DataTypes } from "sequelize";
import { hasColumn } from "../migrate.js";

export async function up({ context: qi, transaction }) {
  if (!(await hasColumn(qi, "Lessons", "finishedAt", transaction))) await qi.addColumn("Lessons", "finishedAt", { type: DataTypes.DATE, allowNull: true }, { transaction });
  if (!(await hasColumn(qi, "Words", "question", transaction))) await qi.addColumn("Words", "question", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, { transaction });
}

export async function down({ context: qi, transaction }) {
  await qi.removeColumn("Words", "question", { transaction });
  await qi.removeColumn("Lessons", "finishedAt", { transaction });
}
