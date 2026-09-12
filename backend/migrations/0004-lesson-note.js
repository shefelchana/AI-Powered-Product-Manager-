// Значение словами преподавателя — рядом со словарным, не вместо него.
import { DataTypes } from "sequelize";
import { hasColumn } from "../migrate.js";

export async function up({ context: qi, transaction }) {
  if (!(await hasColumn(qi, "Words", "lessonNote", transaction))) {
    await qi.addColumn("Words", "lessonNote", { type: DataTypes.TEXT, allowNull: false, defaultValue: "" }, { transaction });
  }
}

export async function down({ context: qi, transaction }) {
  await qi.removeColumn("Words", "lessonNote", { transaction });
}
