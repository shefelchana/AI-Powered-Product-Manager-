// Грубое сравнение значений из двух источников. Намеренно осторожное в сторону
// «пометить спорным»: ложная тревога стоит строки в отчёте, а молча записанное
// неверное объяснение — выученного неправильно слова.
const STOP = new Set(["the", "and", "for", "with", "that", "from", "into"]);

export function significantWords(text) {
  const words = String(text ?? "").toLowerCase().match(/[a-z]{4,}/g) ?? [];
  return new Set(words.filter((word) => !STOP.has(word)));
}

// Сравнение по началу слова, а не по точному совпадению. Иначе источники
// системно расходились бы на ровном месте: «merger» против «merging»,
// «emphasise» против «emphasize». Метка «спорное», срабатывающая на орфографии,
// перестаёт что-либо значить, и её перестают читать.
const STEM_LENGTH = 4;
const stem = (word) => word.slice(0, STEM_LENGTH);

export function sourcesDisagree(first, second) {
  const a = significantWords(first);
  const b = significantWords(second);
  // Сравнивать нечего — молчание не является противоречием.
  if (a.size === 0 || b.size === 0) return false;
  const stems = new Set([...b].map(stem));
  return ![...a].some((word) => stems.has(stem(word)));
}

// Не всякое расхождение — запрет. Источник, помеченный advisory, даёт справку,
// а не толкование (Академия: терминологический эквивалент из отраслевого
// словаря), и его расхождение с переводом законно — это повод посмотреть
// глазами. Запись блокирует только конфликт между словарями значений.
export function conflictReport(answers) {
  const blocking = [];
  const advisory = [];
  for (let i = 0; i < answers.length; i += 1) {
    for (let j = i + 1; j < answers.length; j += 1) {
      if (sourcesDisagree(answers[i].text, answers[j].text)) {
        const bucket = answers[i].advisory || answers[j].advisory ? advisory : blocking;
        bucket.push(`${answers[i].name} против ${answers[j].name}`);
      }
    }
  }
  return { blocking, advisory };
}
