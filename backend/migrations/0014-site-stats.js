// Итог задания на сайте ульпана у урока: отвечено / с ошибками. Единственная внешняя мера прогресса.
import { DataTypes } from "sequelize";
import { hasColumn } from "../migrate.js";

export async function up({ context: qi, transaction }) {
  for (const col of ["siteAnswered", "siteWrong"]) {
    if (!(await hasColumn(qi, "Lessons", col, transaction))) {
      await qi.addColumn("Lessons", col, { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, { transaction });
    }
  }
}
export async function down() { /* колонки остаются */ }
