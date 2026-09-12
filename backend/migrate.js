// Схема доезжает миграциями, а не sync({ alter: true }): alter пересоздаёт
// таблицу с перекладкой строк, и на живой базе это уже стоило данных.
// Журнал выполненного — таблица SchemaMigrations; порядок — по имени файла.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { Umzug, SequelizeStorage } from "umzug";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function makeMigrator(sequelize) {
  return new Umzug({
    migrations: {
      glob: ["migrations/*.js", { cwd: HERE }],
      // Проект — ESM, а umzug по умолчанию делает require(): подменяем загрузку.
      // Каждая миграция — в транзакции: упавшая на середине не оставляет базу
      // полумигрированной (это уже случилось на локальной копии при отладке).
      // Postgres и SQLite умеют откатывать DDL.
      resolve: ({ name, path: file, context }) => ({
        name,
        up: async () => {
          const mod = await import(pathToFileURL(file).href);
          return sequelize.transaction((transaction) => mod.up({ context, transaction }));
        },
        down: async () => {
          const mod = await import(pathToFileURL(file).href);
          return sequelize.transaction((transaction) => mod.down({ context, transaction }));
        },
      }),
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize, tableName: "SchemaMigrations" }),
    logger: undefined,
  });
}

// На Postgres два контейнера могут стартовать одновременно (перекрывающийся
// деплой). Advisory lock держит второго, пока первый не доедет; миграции
// идемпотентны, так что второй просто увидит «нечего делать».
// На SQLite соединение одно, замок не нужен и невозможен.
const LOCK_KEY = 20260912;

export async function migrate(sequelize) {
  if (sequelize.getDialect() !== "postgres") return makeMigrator(sequelize).up();
  return sequelize.transaction(async (transaction) => {
    await sequelize.query(`SELECT pg_advisory_xact_lock(${LOCK_KEY})`, { transaction });
    return makeMigrator(sequelize).up();
  });
}

// Помощники для идемпотентных миграций: журнал пишется после транзакции
// миграции, и обрыв между ними оставил бы применённую, но незаписанную
// миграцию. Повторный запуск должен пройти, а не упасть на «колонка уже есть».
export async function hasTable(qi, table, transaction) {
  return (await qi.showAllTables({ transaction })).includes(table);
}

export async function hasColumn(qi, table, column, transaction) {
  const shape = await qi.describeTable(table, { transaction });
  return Boolean(shape[column]);
}

export async function pendingMigrations(sequelize) {
  const pending = await makeMigrator(sequelize).pending();
  return pending.map((m) => m.name);
}
