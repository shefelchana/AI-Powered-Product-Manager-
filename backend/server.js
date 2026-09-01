import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Op } from "sequelize";
import { sequelize, dbKind } from "./db.js";
import { Word, INTERVALS, LAST_BOX, dayOffset, detectLang, today } from "./models.js";
import { fetchRecord, isTermPath, lookup } from "./academy.js";
import { lookupWiktionary } from "./wiktionary.js";
import { lookupPealim } from "./pealim.js";
import { significantWords, sourcesDisagree } from "./compare.js";

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

const langOf = (req) => (["he", "en", "ru"].includes(req.query.lang) ? req.query.lang : "he");

// Весь список отдаём целиком: по нему считаются счётчики всех языков,
// а разделение делает фронт. Очередь и слово дня фильтруем на сервере.
app.get("/api/words", async (req, res) => {
  const words = await Word.findAll({ order: [["createdAt", "DESC"]] });
  res.json(words);
});

// The review queue. Capped on the server, not the client: a queue with no
// visible bottom is a queue you never start.
app.get("/api/words/due", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || SESSION_LIMIT, SESSION_LIMIT);
  const words = await Word.findAll({
    where: { nextDue: { [Op.lte]: today() }, lang: langOf(req) },
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
    lang: detectLang(term),
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

  if (req.body?.term !== undefined) {
    const term = clean(req.body.term, MAX_TERM);
    if (!term) return res.status(400).json({ error: "Слово не может быть пустым" });
    const clash = await Word.findOne({ where: { term } });
    if (clash && clash.id !== word.id) {
      return res.status(409).json({ error: "Такое слово уже есть", word: clash });
    }
    word.term = term;
    word.lang = detectLang(term);
  }
  if (req.body?.definition !== undefined) {
    const definition = clean(req.body.definition, MAX_DEFINITION);
    // Подпись следует за текстом. Текст переписали руками — своё объяснение
    // главнее, но и ссылку на Академию снимаем: она больше не про этот текст.
    // Сохранение без изменений подпись не трогает.
    if (definition !== word.definition) {
      word.definition = definition;
      word.definitionSource = definition ? "typed" : "";
      word.sourceLabel = "";
      word.sourceUrl = "";
    }
  }
  if (req.body?.translation !== undefined) {
    word.translation = clean(req.body.translation, MAX_TERM);
  }
  if (req.body?.imageUrl !== undefined) {
    word.imageUrl = clean(req.body.imageUrl, 600);
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

// Слово дня: одно слово, с которым живёшь весь день. Берём из плохо знакомых
// (коробки 1-2) и не повторяем то, что уже было — техника про новое слово.
app.get("/api/word-of-day", async (req, res) => {
  const lang = langOf(req);
  const picked = await Word.findOne({ where: { dayPickedAt: today(), lang } });
  if (picked) return res.json(picked);

  const candidates = await Word.findAll({
    where: { box: { [Op.lte]: 2 }, lang },
    order: [["createdAt", "ASC"]],
  });
  if (candidates.length === 0) return res.json(null);

  // Сначала то, что ни разу не было словом дня, потом самое давнее.
  const never = candidates.filter((w) => !w.dayPickedAt);
  const pool = never.length ? never : candidates;
  pool.sort((a, b) => String(a.dayPickedAt ?? "").localeCompare(String(b.dayPickedAt ?? "")));

  const word = pool[0];
  word.dayPickedAt = today();
  await word.save();
  res.json(word);
});

app.post("/api/words/:id/examples", async (req, res) => {
  const text = clean(req.body?.text, MAX_DEFINITION);
  if (!text) return res.status(400).json({ error: "Пример не может быть пустым" });

  const word = await Word.findByPk(req.params.id);
  if (!word) return res.status(404).json({ error: "Слово не найдено" });

  word.examples = word.examples ? `${word.examples}\n${text}` : text;
  await word.save();
  res.json(word);
});

app.delete("/api/words/:id", async (req, res) => {
  const word = await Word.findByPk(req.params.id);
  if (!word) return res.status(404).json({ error: "Слово не найдено" });
  await word.destroy();
  res.json({ ok: true });
});

// Справка из базы Академии языка иврит. Внешний сервис — значит отдельная
// обработка сбоев: слово при неудаче не меняется, ошибка видна.
app.post("/api/words/:id/academy", async (req, res) => {
  const word = await Word.findByPk(req.params.id);
  if (!word) return res.status(404).json({ error: "Слово не найдено" });

  // href приходит с клиента — принимаем только адреса страниц терминов,
  // иначе сервер сходит куда угодно по чужой указке.
  const href = req.body?.href;
  if (href !== undefined && !isTermPath(href)) {
    return res.status(400).json({ error: "Неизвестный адрес записи" });
  }

  // Тот же запрет, что и у POST /definition: заполнять пустое можно,
  // переписывать чужую работу нельзя. Агенту разрешено вызывать оба пути.
  if (word.definition && !req.body?.overwrite) {
    return res.status(409).json({ error: "У слова уже есть объяснение, перезаписывать нельзя", word });
  }

  let found;
  try {
    found = href ? await fetchRecord(href) : await lookup(word.term);
  } catch (error) {
    return res.status(502).json({ error: `База Академии недоступна: ${error.message}` });
  }
  if (!found) {
    return res.status(404).json({ error: "В базе Академии такого слова нет" });
  }
  // Точного совпадения нет — выбирает человек, молча подставлять похожее нельзя.
  if (found.candidates) {
    return res.json({ candidates: found.candidates });
  }

  word.definition = found.definition;
  word.definitionSource = "academy";
  word.sourceLabel = found.sourceLabel;
  word.sourceUrl = found.sourceUrl;
  await word.save();
  res.json(word);
});

// Сверка слова по трём источникам без записи. Решение принимается ДО того,
// как что-то сохранено: правило расхождения иначе не имеет смысла.
//
// Источники дополняют друг друга по покрытию: Академия — термины,
// Викисловарь — существительные, Pealim — глаголы. Поэтому молчание одного
// из них это норма, а не сбой.
app.get("/api/lookup/:term", async (req, res) => {
  const term = clean(req.params.term, MAX_TERM);
  if (!term) return res.status(400).json({ error: "Слово не может быть пустым" });

  // Недоступность одного источника не должна ронять сверку целиком.
  const [academyResult, wiktionaryResult, pealimResult] = await Promise.allSettled([
    lookup(term),
    lookupWiktionary(term),
    lookupPealim(term),
  ]);
  const value = (result) => (result.status === "fulfilled" ? result.value : null);
  const failure = (result) => (result.status === "rejected" ? result.reason.message : null);

  const academy = value(academyResult);
  const wiktionary = value(wiktionaryResult);
  const pealim = value(pealimResult);

  // Варианты Академии — это не ответ, а вопрос к человеку: сравнивать нечего.
  const answers = [
    { name: "Академия", text: academy && !academy.candidates ? academy.definition : "" },
    { name: "Викисловарь", text: wiktionary?.gloss ?? "" },
    { name: "Pealim", text: pealim?.meaning ?? "" },
  ].filter((answer) => answer.text);

  // Спорным слово становится, если хотя бы одна пара ответивших источников
  // не имеет общих значимых слов.
  // Значения из слишком коротких слов сравнению не поддаются.
  const comparable = answers.filter((answer) => significantWords(answer.text).size > 0);

  const conflicts = [];
  for (let i = 0; i < answers.length; i += 1) {
    for (let j = i + 1; j < answers.length; j += 1) {
      if (sourcesDisagree(answers[i].text, answers[j].text)) {
        conflicts.push(`${answers[i].name} против ${answers[j].name}`);
      }
    }
  }

  // Порядок важен. Неоднозначность Академии сама по себе не блокирует: у глаголов
  // почти всегда несколько терминологических записей, и если бы она перебивала
  // ответ Pealim, третий источник не пригодился бы никогда. Блокирует только
  // настоящее противоречие между ответившими.
  const ambiguous = Boolean(academy?.candidates);
  const down = Object.entries({
    Академия: failure(academyResult),
    Викисловарь: failure(wiktionaryResult),
    Pealim: failure(pealimResult),
  })
    .filter(([, message]) => message)
    .map(([name]) => name);

  let verdict;
  // Недоступность источника — это отсутствие проверки, а не отсутствие данных.
  // Без этой ветки сбой сети превращался бы в утверждение «нигде нет» и давал
  // агенту право писать своё объяснение.
  if (down.length === 3) {
    verdict = `ни один источник не ответил (${down.join(", ")}) — сверки не было, записывать нельзя`;
  } else if (conflicts.length > 0) {
    verdict = `источники расходятся (${conflicts.join(", ")}) — записывать нельзя`;
  } else if (comparable.length < 2 && answers.length > 0) {
    // Ответ вроде «to add» состоит из слишком коротких слов: сравнивать нечего.
    // Выдавать это за «источники сходятся» нельзя — «sell» и «buy» так прошли бы
    // как согласие.
    verdict =
      answers.length === 1
        ? `ответил только один источник (${answers[0].name}) — сравнить не с чем`
        : "сравнить нечем: значения слишком короткие для сверки";
  } else if (answers.length > 0) {
    verdict = ambiguous
      ? "источники не противоречат, но у Академии есть похожие слова — учесть при записи"
      : "источники не противоречат друг другу";
  } else if (ambiguous) {
    verdict = "ответила только Академия и предлагает несколько вариантов — выбирает человек";
  } else {
    verdict = "нет данных ни в одном источнике";
  }
  if (down.length > 0 && down.length < 3) {
    verdict += ` (недоступны: ${down.join(", ")}, проверено не полностью)`;
  }

  res.json({
    term,
    academy: academy?.candidates ? { candidates: academy.candidates } : academy,
    wiktionary,
    pealim,
    disagree: conflicts.length > 0,
    conflicts,
    verdict,
    errors: {
      academy: failure(academyResult),
      wiktionary: failure(wiktionaryResult),
      pealim: failure(pealimResult),
    },
  });
});

// Отдельный маршрут, а не PATCH: метку источника ставит сервер, и через него
// можно записать только «сгенерировано». Так агент не выдаст своё объяснение
// за справку Академии или за проверенное Анной.
app.post("/api/words/:id/definition", async (req, res) => {
  const definition = clean(req.body?.text, MAX_DEFINITION);
  if (!definition) return res.status(400).json({ error: "Объяснение не может быть пустым" });

  const word = await Word.findByPk(req.params.id);
  if (!word) return res.status(404).json({ error: "Слово не найдено" });
  // Заполнять пустое можно, переписывать чужую работу нельзя.
  if (word.definition) {
    return res.status(409).json({ error: "У слова уже есть объяснение, перезаписывать нельзя", word });
  }

  word.definition = definition;
  word.definitionSource = "generated";
  word.sourceLabel = "";
  word.sourceUrl = "";
  await word.save();
  res.json(word);
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "public")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });
}

await sequelize.sync({ alter: true });

// Слова, заведённые до появления языков, метим по написанию.
for (const word of await Word.findAll()) {
  const lang = detectLang(word.term);
  if (word.lang !== lang) {
    word.lang = lang;
    await word.save();
  }
}

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT} (db: ${dbKind})`);
});
