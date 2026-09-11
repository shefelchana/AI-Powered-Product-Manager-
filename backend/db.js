// The dialect is chosen from DATABASE_URL so the same config works in both
// environments: blank locally (SQLite file), injected by Render (Postgres).
import fs from "node:fs";
import path from "node:path";
import { Sequelize } from "sequelize";

const url = process.env.DATABASE_URL ?? "";
const isPostgres = url.startsWith("postgres://") || url.startsWith("postgresql://");

export const dbKind = isPostgres ? "postgres" : "sqlite";

export const sequelize = isPostgres
  ? new Sequelize(url, {
      dialect: "postgres",
      logging: false,
      ...(process.env.NODE_ENV === "production"
        ? { dialectOptions: { ssl: { require: true, rejectUnauthorized: false } } }
        : {}),
    })
  : new Sequelize({
      dialect: "sqlite",
      storage: "./data.sqlite",
      logging: false,
    });

// Страховка учебных данных. Колода — один файл SQLite, не попадающий ни в git
// (*.sqlite в .gitignore), ни в снапшоты; гонка перезапусков однажды его
// опустошила. Одно поколение копии при старте — дёшево, а колоду возвращает.
// Postgres на Render бэкапит сам хостинг — там копия не нужна.
export function backupDatabase(storage = "./data.sqlite") {
  if (dbKind !== "sqlite" || !fs.existsSync(storage)) return null;
  const backup = path.join(path.dirname(storage), "data.backup.sqlite");
  fs.copyFileSync(storage, backup);
  return backup;
}
