import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Op } from "sequelize";
import { sequelize, dbKind } from "./db.js";
import { Word, INTERVALS, LAST_BOX, dayOffset, detectLang, today } from "./models.js";
import { fetchRecord, isTermPath, lookup } from "./academy.js";
import { lookupWiktionary } from "./wiktionary.js";
import { lookupPealim } from "./pealim.js";
import { drawImage } from "./draw.js";
import { conflictReport, significantWords } from "./compare.js";

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
const MAX_IMAGE_URL = 2048;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const SESSION_LIMIT = 10;

// Anything the user typed: trimmed, capped, never null.
function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const langOf = (req) => (["he", "en", "ru"].includes(req.query.lang) ? req.query.lang : "he");

// Весь список отдаём целиком: по нему считаются счётчики всех языков,
// а разделение делает фронт. Очередь и слово дня фильтруем на сервере.
// Байты картинок в списке не отдаём: он читается на каждом экране, а это
// мегабайты на ровном месте. Отдаём только признак, что картинка есть.
const withoutImageBytes = (word) => {
  const plain = word.toJSON();
  plain.hasImage = Boolean(plain.imageData);
  delete plain.imageData;
  return plain;
};

app.get("/api/words", async (req, res) => {
  const words = await Word.findAll({ order: [["createdAt", "DESC"]] });
  res.json(words.map(withoutImageBytes));
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
  res.json(words.map(withoutImageBytes));
});

app.post("/api/words", async (req, res) => {
  const term = clean(req.body?.term, MAX_TERM);
  if (!term) {
    return res.status(400).json({ error: "Слово не может быть пустым" });
  }

  const existing = await Word.findOne({ where: { term } });
  if (existing) {
    return res.status(409).json({ error: "Такое слово уже есть", word: withoutImageBytes(existing) });
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
  res.status(201).json(withoutImageBytes(word));
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
      return res.status(409).json({ error: "Такое слово уже есть", word: withoutImageBytes(clash) });
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
    const imageUrl = String(req.body.imageUrl ?? "").trim();
    // Обрезать адрес нельзя: обрезанный ведёт в никуда, и это молчаливая порча.
    if (imageUrl.length > MAX_IMAGE_URL) {
      return res.status(400).json({ error: `Адрес картинки длиннее ${MAX_IMAGE_URL} символов` });
    }
    word.imageUrl = imageUrl;
  }
  await word.save();
  res.json(withoutImageBytes(word));
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
  res.json(withoutImageBytes(word));
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
  res.json(withoutImageBytes(word));
});

app.post("/api/words/:id/examples", async (req, res) => {
  const text = clean(req.body?.text, MAX_DEFINITION);
  if (!text) return res.status(400).json({ error: "Пример не может быть пустым" });

  const word = await Word.findByPk(req.params.id);
  if (!word) return res.status(404).json({ error: "Слово не найдено" });

  word.examples = word.examples ? `${word.examples}\n${text}` : text;
  await word.save();
  res.json(withoutImageBytes(word));
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
    return res.status(409).json({ error: "У слова уже есть объяснение, перезаписывать нельзя", word: withoutImageBytes(word) });
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
  res.json(withoutImageBytes(word));
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
  // Академия помечена advisory: она даёт терминологический эквивалент, а не
  // перевод, и её расхождение со словарями — совет посмотреть, а не запрет.
  // Неразрешённая грамматическая стрелка Викисловаря (grammarOnly) — не значение:
  // в сверку не идёт.
  const answers = [
    { name: "Академия", text: academy && !academy.candidates ? academy.definition : "", advisory: true },
    { name: "Викисловарь", text: wiktionary?.grammarOnly ? "" : wiktionary?.gloss ?? "" },
    { name: "Pealim", text: pealim?.meaning ?? "" },
  ].filter((answer) => answer.text);

  // Спорным слово становится, если хотя бы одна пара ответивших источников
  // не имеет общих значимых слов.
  // Значения из слишком коротких слов сравнению не поддаются.
  const comparable = answers.filter((answer) => significantWords(answer.text).size > 0);

  const { blocking: conflicts, advisory } = conflictReport(answers);

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
  } else if (advisory.length > 0) {
    verdict = `Академия расходится с переводом (${advisory.join(", ")}) — её справка терминологическая, не перевод: взгляните сами; словари значений не противоречат`;
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
    advisory,
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
    return res.status(409).json({ error: "У слова уже есть объяснение, перезаписывать нельзя", word: withoutImageBytes(word) });
  }

  word.definition = definition;
  word.definitionSource = "generated";
  word.sourceLabel = "";
  word.sourceUrl = "";
  await word.save();
  res.json(withoutImageBytes(word));
});

// Запись справки Pealim. Отдельный путь от «сгенерировано»: у глагола есть
// настоящий источник, и подписывать его как выдумку агента было бы неправдой.
// Заодно сохраняются корень и биньян — они факт о слове, а не о значении.
app.post("/api/words/:id/pealim", async (req, res) => {
  const word = await Word.findByPk(req.params.id);
  if (!word) return res.status(404).json({ error: "Слово не найдено" });
  if (word.definition && !req.body?.overwrite) {
    return res.status(409).json({ error: "У слова уже есть объяснение, перезаписывать нельзя", word: withoutImageBytes(word) });
  }

  let found;
  try {
    found = await lookupPealim(word.term);
  } catch (error) {
    return res.status(502).json({ error: `Pealim недоступен: ${error.message}` });
  }
  if (!found) return res.status(404).json({ error: "В Pealim такого слова нет" });

  word.definition = found.meaning;
  word.definitionSource = "pealim";
  word.sourceLabel = ["Pealim", found.binyan, found.translit].filter(Boolean).join(" · ");
  word.sourceUrl = found.sourceUrl;
  word.root = found.root;
  word.binyan = found.binyan;
  await word.save();
  res.json(withoutImageBytes(word));
});

// Слова того же корня. Корень — самая сильная связь между словами в иврите:
// увидев, что слово из уже знакомой семьи, его запоминают заметно легче.
app.get("/api/words/:id/family", async (req, res) => {
  const word = await Word.findByPk(req.params.id);
  if (!word) return res.status(404).json({ error: "Слово не найдено" });
  if (!word.root) return res.json([]);

  const family = await Word.findAll({ where: { root: word.root } });
  res.json(family.filter((relative) => relative.id !== word.id).map(withoutImageBytes));
});

// Скачать картинку и оставить её у себя. Ссылки генераторов подписаны и живут
// часы — сохранённый адрес назавтра ведёт в никуда, а карточка пустеет молча.
app.post("/api/words/:id/image", async (req, res) => {
  const url = String(req.body?.url ?? "").trim();
  if (!/^https:\/\//.test(url)) {
    return res.status(400).json({ error: "Нужен адрес картинки, начинающийся с https://" });
  }
  if (url.length > MAX_IMAGE_URL) {
    return res.status(400).json({ error: `Адрес длиннее ${MAX_IMAGE_URL} символов` });
  }

  const word = await Word.findByPk(req.params.id);
  if (!word) return res.status(404).json({ error: "Слово не найдено" });

  let response;
  try {
    // Без содержательного User-Agent часть хостов (Викимедиа в их числе)
    // отвечает отказом на скачивание.
    response = await fetch(url, {
      headers: { "User-Agent": "vocab-cards/1.0 (https://github.com/shefelchana/AI-Powered-Product-Manager-)" },
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    return res.status(502).json({ error: `Не удалось скачать картинку: ${error.message}` });
  }
  if (!response.ok) {
    return res.status(502).json({ error: `Источник картинки ответил ${response.status}` });
  }

  const mime = (response.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!mime.startsWith("image/")) {
    return res.status(400).json({ error: `По этому адресу не картинка, а ${mime || "неизвестно что"}` });
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) {
    return res.status(400).json({ error: "Картинка больше 3 МБ" });
  }

  word.imageUrl = url;
  word.imageData = bytes;
  word.imageMime = mime;
  await word.save();
  res.json({ ok: true, bytes: bytes.length, mime });
});

app.get("/api/words/:id/image", async (req, res) => {
  const word = await Word.findByPk(req.params.id);
  if (!word?.imageData) return res.status(404).json({ error: "У слова нет картинки" });
  res.set("Content-Type", word.imageMime || "image/png");
  // Картинка неизменна, пока её не заменили: пусть браузер её не перекачивает.
  res.set("Cache-Control", "public, max-age=86400");
  res.send(word.imageData);
});

// Нарисовать образ к слову. По кнопке, не автоматически: метод требует своего
// образа, и решение «этот подходит» остаётся за человеком. Генерация тут
// уместна прежде всего для абстрактных глаголов, которым поиск картинок
// не даёт ничего пригодного.
app.post("/api/words/:id/image/generate", async (req, res) => {
  const word = await Word.findByPk(req.params.id);
  if (!word) return res.status(404).json({ error: "Слово не найдено" });

  let drawn;
  try {
    drawn = await drawImage(word);
  } catch (error) {
    // Отказ модели — это отсутствие картинки, а не повод оставить старую
    // в неопределённом состоянии: ничего не трогаем и говорим причину.
    const status = error.code === "quota" ? 429 : error.code === "no_key" ? 501 : 502;
    return res.status(status).json({ error: error.message });
  }

  word.imageData = drawn.bytes;
  word.imageMime = drawn.mime;
  word.imageUrl = "";
  await word.save();
  res.json({ ok: true, bytes: drawn.bytes.length, mime: drawn.mime });
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
