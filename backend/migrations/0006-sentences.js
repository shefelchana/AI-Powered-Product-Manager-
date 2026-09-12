// Предложения урока с сайта ульпана: русское → эталонный иврит, аудио.
// Отдельно от слов: это единица практики, не карточка.
import { DataTypes } from "sequelize";
import { hasTable } from "../migrate.js";

export async function up({ context: qi, transaction }) {
  if (await hasTable(qi, "Sentences", transaction)) return;
  await qi.createTable("Sentences", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    lessonId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "Lessons", key: "id" }, onDelete: "CASCADE" },
    sourceId: { type: DataTypes.STRING(80), allowNull: false, defaultValue: "" },
    he: { type: DataTypes.TEXT, allowNull: false },
    heVocalized: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    ru: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    en: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    audioUrl: { type: DataTypes.STRING(300), allowNull: false, defaultValue: "" },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // Сколько раз это предложение было с ошибкой на сайте: такие идут в практике первыми.
    wrongCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  }, { transaction });
}

export async function down({ context: qi, transaction }) {
  await qi.dropTable("Sentences", { transaction });
}
