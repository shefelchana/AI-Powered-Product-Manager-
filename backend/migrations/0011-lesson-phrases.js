// Фраза урока у слова: Example получает ссылку на предложение преподавателя (аудио, огласовки)
// и найденную форму слова (для пропуска в строгом режиме). Удаление урока сносит предложения —
// ссылка обнуляется, текст фразы остаётся. Одна связь на пару слово–предложение.
// У слова — отметка, когда искали толкование в Викисловаре: «не нашли» тоже помнится.
import { DataTypes } from "sequelize";
import { hasColumn } from "../migrate.js";

export async function up({ context: qi, transaction }) {
  if (!(await hasColumn(qi, "Examples", "sentenceId", transaction))) {
    await qi.addColumn("Examples", "sentenceId", {
      type: DataTypes.INTEGER, allowNull: true,
      references: { model: "Sentences", key: "id" }, onDelete: "SET NULL",
    }, { transaction });
  }
  if (!(await hasColumn(qi, "Examples", "matched", transaction))) {
    await qi.addColumn("Examples", "matched", { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" }, { transaction });
  }
  const indexes = await qi.showIndex("Examples", { transaction });
  if (!indexes.some((i) => i.name === "examples_word_sentence")) {
    await qi.addIndex("Examples", ["wordId", "sentenceId"], { name: "examples_word_sentence", unique: true, transaction });
  }
  if (!(await hasColumn(qi, "Words", "definitionCheckedAt", transaction))) {
    await qi.addColumn("Words", "definitionCheckedAt", { type: DataTypes.DATE, allowNull: true }, { transaction });
  }
}

export async function down({ context: qi, transaction }) {
  // Данные не удаляем: колонки остаются, откат кода их просто не читает.
  const indexes = await qi.showIndex("Examples", { transaction });
  if (indexes.some((i) => i.name === "examples_word_sentence")) await qi.removeIndex("Examples", "examples_word_sentence", { transaction });
}
