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

// Язык определяем по письменности: выбирать его руками — лишнее решение
// на каждое слово, а буквы говорят сами за себя.
export function detectLang(term) {
  if (/[\u0590-\u05FF]/.test(term)) return "he";
  if (/[\u0400-\u04FF]/.test(term)) return "ru";
  return "en";
}

export const Word = sequelize.define("Word", {
  term: { type: DataTypes.STRING(200), allowNull: false },
  // The Hebrew explanation — the point of the whole thing. Empty is allowed:
  // at a lesson you type the word and nothing else.
  definition: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  // "typed" = Anna wrote it herself, "academy" = the Academy of the Hebrew
  // Language. Empty means there is no definition yet. Whatever the source,
  // it is named on the card: you always know what you are trusting.
  definitionSource: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "" },
  sourceLabel: { type: DataTypes.STRING(300), allowNull: false, defaultValue: "" },
  sourceUrl: { type: DataTypes.STRING(300), allowNull: false, defaultValue: "" },
  translation: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
  // Корень — самая сильная связь между словами в иврите: от одного корня растёт
  // целое семейство, и выучив узор, слово из семьи узнаёшь без словаря.
  // Берётся ТОЛЬКО из словаря, никогда не вычисляется: слабые буквы и удвоения
  // делают выделение корня нетривиальным, а выдуманный корень — та же тихая
  // подмена, что и выдуманное значение.
  root: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "" },
  // Биньян есть только у глаголов и только когда словарь его назвал.
  binyan: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "" },
  // Свой яркий образ к слову: звук и опыт уже есть, картинка — третья часть.
  // Адрес внешний, значит может протухнуть — показ переживает битую ссылку.
  // Откуда картинка взята — для памяти и для повторного скачивания.
  // Ссылки генераторов бывают длиной в полторы тысячи символов: короткое поле
  // молча резало их и превращало в мусор.
  imageUrl: { type: DataTypes.STRING(2048), allowNull: false, defaultValue: "" },
  // Сама картинка. Ссылки на сгенерированные изображения живут часы: в них
  // зашиты срок и подпись. Храним байты у себя, иначе карточка назавтра пустеет,
  // и понять почему нельзя.
  imageData: { type: DataTypes.BLOB, allowNull: true },
  imageMime: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "" },
  // Your own phrases with this word, one per line. A word learned inside a
  // sentence you lived through sticks; a word learned in a column does not.
  examples: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  // The day this word was the word of the day, so it is not picked twice.
  dayPickedAt: { type: DataTypes.DATEONLY, allowNull: true },
  lesson: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
  // Списки языков раздельные: иврит учится отдельно от английского.
  lang: { type: DataTypes.STRING(2), allowNull: false, defaultValue: "he" },
  box: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  nextDue: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: today },
});
