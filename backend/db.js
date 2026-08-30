// The dialect is chosen from DATABASE_URL so the same config works in both
// environments: blank locally (SQLite file), injected by Render (Postgres).
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
