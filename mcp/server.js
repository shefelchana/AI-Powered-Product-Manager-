#!/usr/bin/env node
// MCP-сервер к приложению «Слова с занятий».
//
// Описания инструментов написаны подробно намеренно: агент выбирает инструмент
// по описанию, и при плохом описании он либо не вызовет нужный, либо вызовет
// не вовремя. Описание здесь важнее реализации.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { addExample, askAcademy, checkSources, createWord, dueWords, findByTerm, listWords, setDefinition, BASE } from "./api.js";

const server = new McpServer({ name: "vocab", version: "1.0.0" });

const text = (value) => ({ content: [{ type: "text", text: value }] });
const failure = (value) => ({ content: [{ type: "text", text: value }], isError: true });

const LANGS = { he: "иврит", en: "английский", ru: "русский" };
const langField = z
  .enum(["he", "en", "ru"])
  .optional()
  .describe("Язык: he — иврит (по умолчанию), en — английский, ru — русский");

function describe(word) {
  const parts = [`${word.term} (${LANGS[word.lang] ?? word.lang})`];
  if (word.definition) parts.push(word.definition.replace(/\n/g, " · "));
  if (word.translation) parts.push(`перевод: ${word.translation}`);
  if (word.sourceLabel) parts.push(`источник: ${word.sourceLabel}`);
  parts.push(`коробка ${word.box}, показ ${word.nextDue}`);
  const examples = word.examples ? word.examples.split("\n").filter(Boolean) : [];
  if (examples.length) parts.push(`свои фразы: ${examples.join(" | ")}`);
  return parts.join(" — ");
}

// ---------- чтение ----------

server.registerTool(
  "list_words",
  {
    title: "Список слов",
    description:
      "Показать слова из личной колоды Анны с их объяснениями, переводами, коробкой " +
      "интервального повторения и собственными фразами. Вызывай, когда спрашивают, " +
      "какие слова уже есть, сколько их, какие остались без объяснения, или когда " +
      "нужно проверить, заведено ли слово, прежде чем добавлять его.",
    inputSchema: {
      lang: langField,
      without_definition: z
        .boolean()
        .optional()
        .describe("Только слова, у которых ещё нет объяснения — то, что стоит разобрать"),
    },
  },
  async ({ lang, without_definition }) => {
    try {
      let words = await listWords();
      if (lang) words = words.filter((word) => word.lang === lang);
      if (without_definition) words = words.filter((word) => !word.definition);
      if (words.length === 0) return text("Подходящих слов нет.");
      return text(`Слов: ${words.length}\n\n${words.map(describe).join("\n")}`);
    } catch (error) {
      return failure(error.message);
    }
  }
);

server.registerTool(
  "due_words",
  {
    title: "Слова к повторению",
    description:
      "Показать слова, которые пора повторить сегодня по расписанию интервальных " +
      "повторений. Вызывай на вопросы вроде «что мне сегодня повторять» или «много ли " +
      "накопилось». Список ограничен, чтобы не заваливать: очередь без видимого конца " +
      "не начинают.",
    inputSchema: {
      lang: langField,
      limit: z.number().int().min(1).max(10).optional().describe("Сколько слов вернуть, максимум 10"),
    },
  },
  async ({ lang, limit }) => {
    try {
      const words = await dueWords(limit ?? 10, lang ?? "he");
      if (words.length === 0) return text("На сегодня всё повторено.");
      return text(`К повторению: ${words.length}\n\n${words.map(describe).join("\n")}`);
    } catch (error) {
      return failure(error.message);
    }
  }
);

// ---------- запись ----------

server.registerTool(
  "add_word",
  {
    title: "Добавить слово",
    description:
      "Записать новое слово в колоду. Вызывай, когда Анна встретила незнакомое слово " +
      "и хочет его выучить, в том числе прямо посреди разговора. Язык определяется " +
      "по написанию сам. Объяснение и перевод необязательны — их можно заполнить позже " +
      "или взять из Академии языка иврит. Если слово уже есть, оно не задваивается: " +
      "вернётся существующая запись.",
    inputSchema: {
      term: z.string().min(1).describe("Само слово, как оно пишется"),
      definition: z.string().optional().describe("Объяснение на языке слова, если оно уже известно"),
      translation: z.string().optional().describe("Перевод, если он нужен как страховка"),
    },
  },
  async ({ term, definition, translation }) => {
    try {
      const word = await createWord({ term, definition, translation });
      return text(`Добавлено: ${describe(word)}`);
    } catch (error) {
      if (error.status === 409 && error.data?.word) {
        return text(`Такое слово уже есть, не добавляю второй раз: ${describe(error.data.word)}`);
      }
      return failure(error.message);
    }
  }
);

server.registerTool(
  "add_example",
  {
    title: "Добавить свою фразу",
    description:
      "Добавить к слову собственную фразу с ним — предложение из своей жизни, а не из " +
      "учебника. Это главный способ запомнить слово: оно должно побывать в разных " +
      "ситуациях. Фразы потом показываются при повторении, а слово со своей фразой " +
      "попадает в строгий режим, где ответ надо написать, а не подсмотреть.",
    inputSchema: {
      term: z.string().min(1).describe("Слово, к которому добавляется фраза"),
      text: z.string().min(1).describe("Фраза целиком, обязательно содержащая это слово"),
    },
  },
  async ({ term, text: phrase }) => {
    try {
      const word = await findByTerm(term);
      if (!word) return failure(`Слова «${term}» нет в колоде. Сначала добавь его через add_word.`);
      const updated = await addExample(word.id, phrase);
      return text(`Фраза добавлена: ${describe(updated)}`);
    } catch (error) {
      return failure(error.message);
    }
  }
);

server.registerTool(
  "lookup_in_academy",
  {
    title: "Справка Академии языка иврит",
    description:
      "Взять для слова официальную терминологическую справку из базы Академии языка " +
      "иврит: огласовку, область знания, английский эквивалент и словарь-источник с годом. " +
      "Вызывай, когда у слова нет объяснения или нужно проверить официальный вариант. " +
      "Это справка, а не толкование: связного текста на иврите там обычно нет. " +
      "Если точного совпадения нет, вернутся варианты на выбор — покажи их Анне " +
      "и вызови инструмент снова с выбранным написанием, а не угадывай сам.",
    inputSchema: {
      term: z.string().min(1).describe("Слово из колоды, для которого нужна справка"),
    },
  },
  async ({ term }) => {
    try {
      const word = await findByTerm(term);
      if (!word) return failure(`Слова «${term}» нет в колоде. Сначала добавь его через add_word.`);
      const result = await askAcademy(word.id);
      if (result.candidates) {
        const options = result.candidates.map((c) => c.display).join(" · ");
        return text(
          `Точного совпадения нет. Академия предлагает: ${options}\n` +
            "Спроси Анну, какой вариант нужен, потом добавь его вручную через приложение."
        );
      }
      return text(`Справка получена: ${describe(result)}`);
    } catch (error) {
      if (error.status === 404) return text(`В базе Академии слова «${term}» нет.`);
      return failure(error.message);
    }
  }
);

server.registerTool(
  "check_sources",
  {
    title: "Сверить слово по трём источникам",
    description:
      "Спросить про слово Академию языка иврит, английский Викисловарь и Pealim сразу " +
      "и сравнить их ответы, ничего не записывая. Если слово пришло с урока, в ответе есть " +
      "строка «Урок (преподаватель)» — четвёртый источник, совещательный: его не трогать и не выбирать.  Вызывай ПЕРЕД тем, как записывать " +
      "объяснение. Источники покрывают разное: Академия — термины, Викисловарь — " +
      "существительные, Pealim — глаголы, поэтому молчание одного из них это норма. " +
      "Если вердикт говорит, что источники расходятся — не выбирай сам: слово спорное, " +
      "сообщи о нём и оставь как есть. Викисловарь и Pealim дополнительно дают " +
      "транслитерацию латиницей, показывающую звучание.",
    inputSchema: { term: z.string().min(1).describe("Слово, которое надо сверить") },
  },
  async ({ term }) => {
    try {
      const result = await checkSources(term);
      const lines = [`Вердикт: ${result.verdict}`];
      if (result.academy?.candidates) {
        lines.push(`Академия, варианты: ${result.academy.candidates.map((c) => c.display).join(" · ")}`);
      } else if (result.academy) {
        lines.push(`Академия: ${result.academy.definition} (${result.academy.sourceLabel})`);
      } else {
        lines.push("Академия: нет данных");
      }
      lines.push(
        result.wiktionary
          ? `Викисловарь: ${result.wiktionary.vocalized} (${result.wiktionary.translit}) — ${result.wiktionary.gloss}`
          : "Викисловарь: нет данных"
      );
      lines.push(
        result.pealim
          ? `Pealim: ${result.pealim.meaning} (${result.pealim.translit}, ${result.pealim.binyan})`
          : "Pealim: нет данных"
      );
      if (result.lesson?.note) lines.push(`Урок (преподаватель): ${result.lesson.note} — совещательно, не перезаписывать`);
      for (const [name, message] of Object.entries(result.errors)) {
        if (message) lines.push(`⚠️ ${name} недоступен: ${message}`);
      }
      return text(lines.join("\n"));
    } catch (error) {
      return failure(error.message);
    }
  }
);

server.registerTool(
  "set_definition",
  {
    title: "Записать своё объяснение",
    description:
      "Записать объяснение слова, которого нет ни в одном источнике. Объяснение " +
      "сохраняется с пометкой «сгенерировано, проверь», и эта пометка видна на карточке. " +
      "Записывать можно только слову БЕЗ объяснения: существующее не перезаписывается. " +
      "Не вызывай, пока не сверил слово через check_sources.",
    inputSchema: {
      term: z.string().min(1).describe("Слово из колоды"),
      definition: z
        .string()
        .min(1)
        .describe("Объяснение на языке слова: одна строка простыми словами плюс пример употребления"),
    },
  },
  async ({ term, definition }) => {
    try {
      const word = await findByTerm(term);
      if (!word) return failure(`Слова «${term}» нет в колоде.`);
      const updated = await setDefinition(word.id, definition);
      return text(`Записано с пометкой «сгенерировано, проверь»: ${describe(updated)}`);
    } catch (error) {
      if (error.status === 409) return failure(`У слова «${term}» уже есть объяснение, не трогаю.`);
      return failure(error.message);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`vocab MCP запущен, API: ${BASE}`);
