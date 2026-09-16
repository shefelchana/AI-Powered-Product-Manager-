// Тьютору нужно знать не только «промах», но и что именно было написано: иначе объяснять нечего.
// Попытки хранят ответ ученицы (given); предложения с сайта — её ответ и слово, отмеченное сайтом.
import { DataTypes } from "sequelize";
import { hasColumn } from "../migrate.js";

export async function up({ context: qi, transaction }) {
  for (const table of ["PracticeAttempts", "ReviewAttempts"]) {
    if (!(await hasColumn(qi, table, "given", transaction))) {
      await qi.addColumn(table, "given", { type: DataTypes.STRING(300), allowNull: false, defaultValue: "" }, { transaction });
    }
  }
  if (!(await hasColumn(qi, "Sentences", "myAnswer", transaction))) {
    await qi.addColumn("Sentences", "myAnswer", { type: DataTypes.TEXT, allowNull: false, defaultValue: "" }, { transaction });
  }
  if (!(await hasColumn(qi, "Sentences", "lastGiven", transaction))) {
    await qi.addColumn("Sentences", "lastGiven", { type: DataTypes.STRING(300), allowNull: false, defaultValue: "" }, { transaction });
  }
  if (!(await hasColumn(qi, "Sentences", "siteMistakes", transaction))) {
    await qi.addColumn("Sentences", "siteMistakes", { type: DataTypes.STRING(300), allowNull: false, defaultValue: "" }, { transaction });
  }
}

export async function down() {
  // Колонки остаются: данные ученицы не удаляем откатом кода.
}
