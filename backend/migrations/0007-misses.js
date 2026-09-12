// Счётчик промахов на повторении: после третьего приложение предлагает
// нарисовать образ к слову — картинка идёт туда, где слово не держится.
import { DataTypes } from "sequelize";
import { hasColumn } from "../migrate.js";

export async function up({ context: qi, transaction }) {
  if (!(await hasColumn(qi, "Words", "misses", transaction))) {
    await qi.addColumn("Words", "misses", { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, { transaction });
  }
}

export async function down({ context: qi, transaction }) {
  await qi.removeColumn("Words", "misses", { transaction });
}
