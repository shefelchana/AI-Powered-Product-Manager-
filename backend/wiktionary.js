// Разбор текстовой выжимки статьи. Формат может измениться в любой момент,
// поэтому любая неудача читается как «данных нет», а не как пустой результат.
const HEADING = /^=+\s*(.+?)\s*=+$/;

export function parseEntry(extract) {
  const lines = String(extract ?? "").split("\n");

  // Ивритский раздел: от «== Hebrew ==» до следующего заголовка того же уровня.
  const start = lines.findIndex((line) => /^==\s*Hebrew\s*==$/.test(line.trim()));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^==\s*[^=].*==$/.test(line.trim()));
  const section = end === -1 ? rest : rest.slice(0, end);

  // Заголовочная строка статьи — единственная с «•». Если частей речи несколько
  // (например, «חנוכה»: и Proper noun, и Noun — у каждой своя строка «•» и своё
  // значение), угадывать нужную нельзя. Правило то же, что у Академии для
  // нескольких вариантов: неоднозначность не разрешаем автоматически, отдаём
  // «нет данных» — безопаснее ошибиться в сторону «не нашли», чем подставить
  // значение не той части речи.
  const headIndices = section.reduce((acc, line, i) => {
    if (line.includes("•")) acc.push(i);
    return acc;
  }, []);
  if (headIndices.length !== 1) return null;
  const headIndex = headIndices[0];
  const head = section[headIndex].trim();

  const vocalized = head.split("•")[0].trim();
  const translit = head.match(/•\s*\(([^)]+)\)/)?.[1]?.trim() ?? "";
  const gender = head.match(/\)\s+(m|f)\b/)?.[1] ?? "";

  // Значения — все строки после заголовочной до следующего заголовка. Раньше
  // бралась только первая, и у מיזוג «air conditioning» пропадало без следа.
  // Несколько значений одной части речи — это не противоречие, а полнота:
  // в отличие от разных частей речи, отбрасывать здесь нечего.
  const glosses = [];
  for (const raw of section.slice(headIndex + 1)) {
    const line = raw.trim();
    if (!line) continue;
    if (HEADING.test(line)) break;
    glosses.push(line);
  }
  const gloss = glosses.join("; ");

  if (!vocalized || !gloss) return null;
  return { vocalized, translit, gender, gloss };
}

// Сетевая часть: тянем текстовую выжимку статьи из английского Викисловаря.
// Второй источник справок — им сверяем данные Академии языка иврит.
const API = "https://en.wiktionary.org/w/api.php";
// Викимедиа режет запросы без содержательного User-Agent — это их требование,
// а не перестраховка: без него приходит 429.
const UA = "vocab-cards/1.0 (personal Hebrew study tool; https://github.com/shefelchana/AI-Powered-Product-Manager-)";
// Пауза между запросами — вежливость к чужому бесплатному API: одиночные
// обращения оно терпит, очередь без пауз — уже нет.
const GAP_MS = 1100;
const TIMEOUT_MS = 20000;

let lastCall = 0;

// Пауза считается от прошлого запроса, а не спит фиксированно: если между
// вызовами и так прошла секунда, ждать нечего.
async function paced(url) {
  const wait = GAP_MS - (Date.now() - lastCall);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCall = Date.now();
  return fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

export async function lookupWiktionary(term) {
  const clean = String(term ?? "").trim();
  if (!clean) return null;

  const url = `${API}?action=query&format=json&prop=extracts&explaintext=1&titles=${encodeURIComponent(clean)}`;

  let res;
  // 429 — не отказ, а «слишком часто»: повторяем с растущей задержкой.
  // После последней попытки не ждём: ждать уже некого, дальше только ошибка.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    res = await paced(url);
    if (res.status !== 429) break;
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
  }
  if (!res.ok) throw new Error(`Викисловарь ответил ${res.status}`);

  // При троттлинге Викимедиа отвечает простым текстом («You are making too many
  // requests…»), иногда даже со статусом 200. res.json() на этом бросает
  // SyntaxError, который уходит наверх как «Unexpected token 'Y'» — сообщение,
  // по которому причину не найти.
  const body = await res.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`Викисловарь ответил не JSON: ${body.slice(0, 120)}`);
  }
  const page = Object.values(data?.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined) return null;

  // null от parseEntry — «данных нет» (в том числе когда статья неоднозначна),
  // а не сбой: наверх уходит null, исключение здесь неуместно.
  const entry = parseEntry(page.extract);
  if (!entry) return null;
  return { ...entry, sourceUrl: `https://en.wiktionary.org/wiki/${encodeURIComponent(clean)}#Hebrew` };
}
