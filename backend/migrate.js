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

export async function migrate(sequelize) {
  return makeMigrator(sequelize).up();
}

export async function pendingMigrations(sequelize) {
  const pending = await makeMigrator(sequelize).pending();
  return pending.map((m) => m.name);
}
