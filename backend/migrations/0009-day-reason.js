// Причина выбора слова дня хранится рядом с датой выбора: в течение дня она
// не должна меняться, даже если промахи или коробка уже изменились.
import { DataTypes } from "sequelize";
import { hasColumn } from "../migrate.js";

export async function up({ context: qi, transaction }) {
  if (!(await hasColumn(qi, "Words", "dayReason", transaction))) {
    await qi.addColumn("Words", "dayReason", { type: DataTypes.STRING(80), allowNull: false, defaultValue: "" }, { transaction });
  }
}

export async function down({ context: qi, transaction }) {
  await qi.removeColumn("Words", "dayReason", { transaction });
}
