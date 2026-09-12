// Урок можно закончить (finishedAt), у слова — флажок «?» («не поняла, спросить»).
import { DataTypes } from "sequelize";

export async function up({ context: qi, transaction }) {
  await qi.addColumn("Lessons", "finishedAt", { type: DataTypes.DATE, allowNull: true }, { transaction });
  await qi.addColumn("Words", "question", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, { transaction });
}

export async function down({ context: qi, transaction }) {
  await qi.removeColumn("Words", "question", { transaction });
  await qi.removeColumn("Lessons", "finishedAt", { transaction });
}
