// One table is enough for now: a word captured at a lesson, plus where it sits
// in the Leitner boxes. The dialect comes from db.js, so this works on both
// SQLite and Postgres without changes.
import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

// Box 1 is "just met it", box 5 is "learned". Days until the next review:
export const INTERVALS = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };
export const LAST_BOX = 5;

export function dayOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const today = () => dayOffset(0);

export const Word = sequelize.define("Word", {
  term: { type: DataTypes.STRING(200), allowNull: false },
  // The Hebrew explanation — the point of the whole thing. Empty is allowed:
  // at a lesson you type the word and nothing else.
  definition: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  // "typed" = Anna wrote it herself, "generated" = a model did (pass 2).
  // Empty means there is no definition yet.
  definitionSource: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "" },
  translation: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
  lesson: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
  box: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  nextDue: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: today },
});
