// One table is enough for now: a word captured at a lesson, plus where it sits
// in the Leitner boxes. The dialect comes from db.js, so this works on both
// SQLite and Postgres without changes.
import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

// Box 1 is "just met it", box 5 is "learned". Days until the next review.
// Box 1 repeats the same day: the forgetting curve is steepest in the first
// 24 hours, so the first repetition has to land before the day is out.
export const INTERVALS = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 16 };
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
  // Your own phrases with this word, one per line. A word learned inside a
  // sentence you lived through sticks; a word learned in a column does not.
  examples: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  // The day this word was the word of the day, so it is not picked twice.
  dayPickedAt: { type: DataTypes.DATEONLY, allowNull: true },
  lesson: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
  box: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  nextDue: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: today },
});
