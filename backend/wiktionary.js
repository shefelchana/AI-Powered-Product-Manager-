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

  // Значение — первая непустая строка после заголовочной, которая сама не заголовок.
  const gloss = section
    .slice(headIndex + 1)
    .map((line) => line.trim())
    .find((line) => line && !HEADING.test(line));

  if (!vocalized || !gloss) return null;
  return { vocalized, translit, gender, gloss };
}
