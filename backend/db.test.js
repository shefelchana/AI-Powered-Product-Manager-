import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { backupDatabase } from "./db.js";

// Страховка учебных данных: колода живёт в одном файле SQLite без бэкапов,
// и однажды гонка перезапусков его опустошила. Копия при старте — одно
// поколение, дешёво и достаточно, чтобы пережить следующую аварию.

test("копия кладётся рядом и содержит то же самое", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "db-"));
  const source = path.join(dir, "data.sqlite");
  fs.writeFileSync(source, "содержимое");
  const backup = backupDatabase(source);
  assert.equal(backup, path.join(dir, "data.backup.sqlite"));
  assert.equal(fs.readFileSync(backup, "utf8"), "содержимое");
});

test("прошлая копия перезаписывается — поколение одно", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "db-"));
  const source = path.join(dir, "data.sqlite");
  fs.writeFileSync(source, "новое");
  fs.writeFileSync(path.join(dir, "data.backup.sqlite"), "старое");
  backupDatabase(source);
  assert.equal(fs.readFileSync(path.join(dir, "data.backup.sqlite"), "utf8"), "новое");
});

test("нет файла базы — нет и копии, это не ошибка", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "db-"));
  assert.equal(backupDatabase(path.join(dir, "data.sqlite")), null);
  assert.equal(fs.existsSync(path.join(dir, "data.backup.sqlite")), false);
});
