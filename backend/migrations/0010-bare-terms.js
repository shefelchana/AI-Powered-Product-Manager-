// Слова, записанные с огласовками до 14.09, приводятся к голому написанию:
// иначе проверка дублей и поиск значения преподавателя (точное совпадение)
// их не видят. Столкновение с уже существующим голым написанием не решаем
// автоматически — такие ряды остаются как есть, их разберёт человек.
import { bareTerm } from "../terms.js";

export async function up({ context: qi, transaction }) {
  const [rows] = await qi.sequelize.query('SELECT "id", "term" FROM "Words"', { transaction });
  const taken = new Set(rows.map((r) => r.term));
  for (const row of rows) {
    const bare = bareTerm(row.term);
    if (!bare || bare === row.term || taken.has(bare)) continue;
    await qi.sequelize.query('UPDATE "Words" SET "term" = :term WHERE "id" = :id', { replacements: { term: bare, id: row.id }, transaction });
    taken.add(bare);
  }
}

export async function down() {
  // Огласовки не восстановить: откат — ничего не делать.
}
