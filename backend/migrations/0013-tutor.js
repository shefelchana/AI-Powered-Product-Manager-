// Тьютор: дневной счётчик вызовов модели (в базе, а не в памяти: сервер на Render перезапускается)
// и заметки тьютора (дайджест недели кэшируется на 7 дней).
import { DataTypes } from "sequelize";
import { hasTable } from "../migrate.js";

const STAMPS = {
  createdAt: { type: DataTypes.DATE, allowNull: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false },
};

export async function up({ context: qi, transaction }) {
  if (!(await hasTable(qi, "TutorCalls", transaction))) await qi.createTable("TutorCalls", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    day: { type: DataTypes.STRING(10), allowNull: false, unique: true },
    count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ...STAMPS,
  }, { transaction });
  if (!(await hasTable(qi, "TutorNotes", transaction))) await qi.createTable("TutorNotes", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    kind: { type: DataTypes.STRING(20), allowNull: false },
    forDate: { type: DataTypes.STRING(10), allowNull: false },
    json: { type: DataTypes.TEXT, allowNull: false, defaultValue: "{}" },
    ...STAMPS,
  }, { transaction });
}

export async function down({ context: qi, transaction }) {
  await qi.dropTable("TutorNotes", { transaction });
  await qi.dropTable("TutorCalls", { transaction });
}
