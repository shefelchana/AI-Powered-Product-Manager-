// Третий источник — pealim.com, спрягатель ивритских глаголов.
//
// Зачем он нужен: Академия — словарь терминов, Викисловарь — в основном
// существительные. Глаголов нет ни там, ни там, а именно их чаще всего
// приносят с лекции. Без этого источника сверка почти всегда упиралась бы
// в «оба молчат».
import { parseConjugation } from "./conjugation.js";

const BASE = "https://www.pealim.com";
// Сайт чужой и небольшой: ходим редко и представляемся честно.
const UA = "vocab-cards/1.0 (personal Hebrew study tool; https://github.com/shefelchana/AI-Powered-Product-Manager-)";
const GAP_MS = 1100;
const TIMEOUT_MS = 20000;
// Поиск всегда что-то возвращает: на бессмыслицу «קשקוש123» он отдал статью
// про агору. Поэтому найденное слово сверяется с запрошенным, иначе клиент
// принимал бы первую попавшуюся ссылку за ответ.
const bare = (text) => String(text ?? "").replace(/[֑-ׇ]/g, "").trim();

let lastCall = 0;

async function paced(url) {
  const wait = GAP_MS - (Date.now() - lastCall);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCall = Date.now();
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Pealim ответил ${res.status}`);
  return res.text();
}

const unescapeHtml = (text) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

// Заголовок страницы устроен так:
//   להזדרז – to hurry up, to hustle – Hebrew conjugation tables
// Разделитель — длинное тире (U+2013), не дефис. Частей ровно три; всё, что
// разобрать не удалось, читается как отсутствие данных, а не как пустое значение.
export function parseTitle(title) {
  const parts = unescapeHtml(String(title ?? "")).split("–").map((part) => part.trim());
  if (parts.length < 3) return null;
  const [term, meaning] = parts;
  if (!term || !meaning) return null;
  return { term, meaning };
}

// Биньян размечен строкой «Verb – HITPA'EL» перед корнем. Привязка к ней
// обязательна: при поиске по всей странице существительное מיזוג получало
// PA'AL из постороннего места — правдоподобная выдумка вместо пустого поля.
export function parseBinyan(page) {
  // Апостроф в разметке экранирован (&apos;), поэтому в шаблоне он произвольный.
  const match = String(page ?? "").match(
    /Verb\s*[–-]\s*(PA|PI|HIF|HITPA|NIF|HUF|PU)(?:&apos;|&#39;|')(EL|AL|IL)/i
  );
  return match ? `${match[1]}'${match[2]}`.toUpperCase() : "";
}

// Корень напечатан как «Root: ז - ר - ז». Приводим к общепринятой записи
// через маленькое тире: ז־ר־ז.
export function parseRoot(page) {
  // Корень напечатан как «Root: ז - ר - ז», а сразу за ним без разделителя идёт
  // английский текст. Поэтому берём именно последовательность букв через дефис
  // и на ней останавливаемся — иначе в корень затекают соседние слова.
  const raw = String(page ?? "").match(
    /Root:\s*((?:[\u05D0-\u05EA]\s*-\s*)+[\u05D0-\u05EA])/
  )?.[1];
  if (!raw) return "";
  const letters = raw.match(/[\u05D0-\u05EA]/g) ?? [];
  return letters.length >= 2 ? letters.join("־") : "";
}

export async function lookupPealim(term) {
  const clean = String(term ?? "").trim();
  if (!clean) return null;

  const found = await paced(`${BASE}/search/?q=${encodeURIComponent(clean)}`);
  // Поиск ранжирует по релевантности, берём первую ссылку. Угадывать между
  // ссылками не пытаемся: не разобрали заголовок — значит данных нет.
  const href = found.match(/href="(\/dict\/\d+-[^"]+)"/)?.[1];
  if (!href) return null;

  const page = await paced(BASE + href);
  const entry = parseTitle(page.match(/<title>([\s\S]*?)<\/title>/)?.[1]);
  if (!entry) return null;
  // Не то слово — значит данных нет. Правдоподобный чужой ответ хуже пустого.
  if (bare(entry.term) !== bare(clean)) return null;

  return {
    ...entry,
    root: parseRoot(page),
    binyan: parseBinyan(page),
    // Транслитерация лежит в слаге ссылки: /dict/532-lehizdarez/
    translit: href.match(/\/dict\/\d+-([^/]+)/)?.[1] ?? "",
    sourceUrl: BASE + href,
    // Таблица спряжения — для практики форм. Не глагол — пустой объект.
    forms: parseConjugation(page),
  };
}
