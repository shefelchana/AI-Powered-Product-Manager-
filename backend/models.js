// One table is enough for now: a word captured at a lesson, plus where it sits
// in the Leitner boxes. The dialect comes from db.js, so this works on both
// SQLite and Postgres without changes.
import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

// Box 1 is "just met it", box 5 is "learned". Days until the next review.
// Box 1 repeats the same day: the forgetting curve is steepest in the first
// 24 hours, so the first repetition has to land before the day is out.
// Само расписание — в schedule.js (чистые функции, тесты). Здесь только реэкспорт.
import { INTERVALS, LAST_BOX, dayOffsetFrom, localToday } from "./schedule.js";
export { INTERVALS, LAST_BOX };

export const dayOffset = (days) => dayOffsetFrom(new Date(), days);
export const today = () => localToday();

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
  // Урок, на котором слово записано. Пусто — добавлено вне урока.
  lessonId: { type: DataTypes.INTEGER, allowNull: true },
  // «?» — не поняла на уроке, спросить. Снимается руками.
  question: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  // Значение словами преподавателя. Словарное значение оно не заменяет.
  lessonNote: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  // Таблица форм глагола из Pealim, JSON-строкой. Пусто — не глагол или не запрашивали.
  forms: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  // Сколько раз слово не вспомнилось на повторении. После третьего — «нарисовать образ?».
  misses: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  box: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  nextDue: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: today },
});

// Урок — сущность, а не строка: к нему привязываются слова и фразы, по нему
// собирается «повторить урок». Ссылка на запись и расшифровку — если есть.
export const Lesson = sequelize.define("Lesson", {
  date: { type: DataTypes.DATEONLY, allowNull: false },
  title: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
  recordingUrl: { type: DataTypes.STRING(2048), allowNull: false, defaultValue: "" },
  transcriptPath: { type: DataTypes.STRING(500), allowNull: false, defaultValue: "" },
  importedAt: { type: DataTypes.DATE, allowNull: true },
  // Пусто — урок идёт; всё добавленное привязывается к нему.
  finishedAt: { type: DataTypes.DATE, allowNull: true },
});

// Пример — строка с происхождением. Строгий режим должен знать, чья это
// фраза: своя, из урока или из словаря. Старое текстовое поле Words.examples
// больше не читается и не пишется; уберёт отдельная миграция.
export const EXAMPLE_ORIGINS = ["own", "lesson", "dictionary"];
export const Example = sequelize.define("Example", {
  wordId: { type: DataTypes.INTEGER, allowNull: false },
  text: { type: DataTypes.TEXT, allowNull: false },
  origin: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "own" },
  lessonId: { type: DataTypes.INTEGER, allowNull: true },
  timestamp: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "" },
});

Word.belongsTo(Lesson, { foreignKey: "lessonId", as: "lessonRef" });
Lesson.hasMany(Word, { foreignKey: "lessonId" });
Word.hasMany(Example, { foreignKey: "wordId", as: "exampleRows", onDelete: "CASCADE", hooks: true });
Example.belongsTo(Word, { foreignKey: "wordId" });
Example.belongsTo(Lesson, { foreignKey: "lessonId" });

// Примеры едут вместе со словом везде: так ни один маршрут не забудет их
// подгрузить, а фронтенд получает examples строкой, как и раньше.
// separate: примеры отдельным запросом, а не JOIN. JOIN размножал бы байты
// картинки на число фраз и ломал Word.count().
Word.addScope("defaultScope", {
  include: [{ model: Example, as: "exampleRows", separate: true, order: [["id", "ASC"]] }],
}, { override: true });

// Попытка в практике форм: по каким формам промахи, чтобы спрашивать их чаще.
export const PracticeAttempt = sequelize.define("PracticeAttempt", {
  wordId: { type: DataTypes.INTEGER, allowNull: false },
  formId: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "" },
  ok: { type: DataTypes.BOOLEAN, allowNull: false },
});
PracticeAttempt.belongsTo(Word, { foreignKey: "wordId" });

// Предложение урока: русское → эталонный иврит преподавателя, с аудио.
export const Sentence = sequelize.define("Sentence", {
  lessonId: { type: DataTypes.INTEGER, allowNull: false },
  sourceId: { type: DataTypes.STRING(80), allowNull: false, defaultValue: "" },
  he: { type: DataTypes.TEXT, allowNull: false },
  heVocalized: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  ru: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  en: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  audioUrl: { type: DataTypes.STRING(300), allowNull: false, defaultValue: "" },
  position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  wrongCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
});
Sentence.belongsTo(Lesson, { foreignKey: "lessonId" });
Lesson.hasMany(Sentence, { foreignKey: "lessonId" });

// Ответ на повторении: журнал для удержания и точности по неделям.
export const ReviewAttempt = sequelize.define("ReviewAttempt", {
  wordId: { type: DataTypes.INTEGER, allowNull: false },
  known: { type: DataTypes.BOOLEAN, allowNull: false },
  mode: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "" },
  boxBefore: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  boxAfter: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
});
ReviewAttempt.belongsTo(Word, { foreignKey: "wordId" });
