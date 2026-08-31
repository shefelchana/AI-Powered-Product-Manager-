import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Op } from "sequelize";
import { sequelize, dbKind } from "./db.js";
import { Word, INTERVALS, LAST_BOX, dayOffset, today } from "./models.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
app.use(express.json());

app.get("/api/health", async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: "ok", db: dbKind });
  } catch (error) {
    res.status(500).json({ status: "error", db: dbKind, message: error.message });
  }
});

app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from the backend 👋" });
});


const MAX_TERM = 200;
const MAX_DEFINITION = 1000;
const SESSION_LIMIT = 10;

// Anything the user typed: trimmed, capped, never null.
function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

app.get("/api/words", async (req, res) => {
  const words = await Word.findAll({ order: [["createdAt", "DESC"]] });
  res.json(words);
});

// The review queue. Capped on the server, not the client: a queue with no
// visible bottom is a queue you never start.
app.get("/api/words/due", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || SESSION_LIMIT, SESSION_LIMIT);
  const words = await Word.findAll({
    where: { nextDue: { [Op.lte]: today() } },
    order: [["box", "ASC"], ["createdAt", "ASC"]],
    limit,
  });
  res.json(words);
});

app.post("/api/words", async (req, res) => {
  const term = clean(req.body?.term, MAX_TERM);
  if (!term) {
    return res.status(400).json({ error: "Слово не может быть пустым" });
  }

  const existing = await Word.findOne({ where: { term } });
  if (existing) {
    return res.status(409).json({ error: "Такое слово уже есть", word: existing });
  }

  const definition = clean(req.body?.definition, MAX_DEFINITION);
  const word = await Word.create({
    term,
    definition,
    definitionSource: definition ? "typed" : "",
    translation: clean(req.body?.translation, MAX_TERM),
    lesson: clean(req.body?.lesson, 120),
    box: 1,
    nextDue: today(),
  });
  res.status(201).json(word);
});

// Filling in a definition later, at home, when there is attention for it.
app.patch("/api/words/:id", async (req, res) => {
  const word = await Word.findByPk(req.params.id);
  if (!word) return res.status(404).json({ error: "Слово не найдено" });

  if (req.body?.definition !== undefined) {
    word.definition = clean(req.body.definition, MAX_DEFINITION);
    word.definitionSource = word.definition ? "typed" : "";
  }
  if (req.body?.translation !== undefined) {
    word.translation = clean(req.body.translation, MAX_TERM);
  }
  await word.save();
  res.json(word);
});

app.patch("/api/words/:id/review", async (req, res) => {
  if (typeof req.body?.known !== "boolean") {
    return res.status(400).json({ error: "Нужно поле known: true или false" });
  }
  const word = await Word.findByPk(req.params.id);
  if (!word) return res.status(404).json({ error: "Слово не найдено" });

  word.box = req.body.known ? Math.min(word.box + 1, LAST_BOX) : 1;
  word.nextDue = dayOffset(INTERVALS[word.box]);
  await word.save();
  res.json(word);
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "public")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });
}

await sequelize.sync();

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT} (db: ${dbKind})`);
});
