// Формы глагола — из таблицы спряжения Pealim. Ничего не вычисляется:
// нет таблицы — нет формы. Идентификаторы ячеек у Pealim устойчивые:
// AP-ms/fs/mp/fp — настоящее по роду и числу, PERF-* — прошедшее по лицам,
// IMPF-* — будущее по лицам, IMP-* — повелительное, INF-L — инфинитив.
const NIQQUD = /[֑-ׇ]/g;
const NOISE = /[!‎‏‪-‮]/g;

export const FORM_LABELS = {
  "AP-ms": { ru: "я/ты/он, м. р. (настоящее)", pronoun: "הוא", tense: "настоящее" },
  "AP-fs": { ru: "я/ты/она, ж. р. (настоящее)", pronoun: "היא", tense: "настоящее" },
  "AP-mp": { ru: "мы/вы/они, м. р. (настоящее)", pronoun: "הם", tense: "настоящее" },
  "AP-fp": { ru: "мы/вы/они, ж. р. (настоящее)", pronoun: "הן", tense: "настоящее" },
  "PERF-1s": { ru: "я (прошедшее)", pronoun: "אני", tense: "прошедшее" },
  "PERF-2ms": { ru: "ты, м. р. (прошедшее)", pronoun: "אתה", tense: "прошедшее" },
  "PERF-2fs": { ru: "ты, ж. р. (прошедшее)", pronoun: "את", tense: "прошедшее" },
  "PERF-3ms": { ru: "он (прошедшее)", pronoun: "הוא", tense: "прошедшее" },
  "PERF-3fs": { ru: "она (прошедшее)", pronoun: "היא", tense: "прошедшее" },
  "PERF-1p": { ru: "мы (прошедшее)", pronoun: "אנחנו", tense: "прошедшее" },
  "PERF-2mp": { ru: "вы, м. р. (прошедшее)", pronoun: "אתם", tense: "прошедшее" },
  "PERF-2fp": { ru: "вы, ж. р. (прошедшее)", pronoun: "אתן", tense: "прошедшее" },
  "PERF-3p": { ru: "они (прошедшее)", pronoun: "הם", tense: "прошедшее" },
  "IMPF-1s": { ru: "я (будущее)", pronoun: "אני", tense: "будущее" },
  "IMPF-2ms": { ru: "ты, м. р. (будущее)", pronoun: "אתה", tense: "будущее" },
  "IMPF-2fs": { ru: "ты, ж. р. (будущее)", pronoun: "את", tense: "будущее" },
  "IMPF-3ms": { ru: "он (будущее)", pronoun: "הוא", tense: "будущее" },
  "IMPF-3fs": { ru: "она (будущее)", pronoun: "היא", tense: "будущее" },
  "IMPF-1p": { ru: "мы (будущее)", pronoun: "אנחנו", tense: "будущее" },
  "IMPF-2mp": { ru: "вы, м. р. (будущее)", pronoun: "אתם", tense: "будущее" },
  "IMPF-3mp": { ru: "они, м. р. (будущее)", pronoun: "הם", tense: "будущее" },
  "IMP-2ms": { ru: "ты, м. р. (повелительное)", pronoun: "אתה", tense: "повелительное" },
  "IMP-2fs": { ru: "ты, ж. р. (повелительное)", pronoun: "את", tense: "повелительное" },
  "IMP-2mp": { ru: "вы (повелительное)", pronoun: "אתם", tense: "повелительное" },
};

const strip = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#\d+;|&[a-z]+;/g, " ")
    .replace(NOISE, "")
    .replace(/\s+/g, " ")
    .trim();

export function parseConjugation(html) {
  const forms = {};
  const text = String(html ?? "");
  const re = /id="((?:AP|PERF|IMPF|IMP|INF)-[0-9a-zA-Z]+)"[^>]*>([\s\S]*?)<\/div>/g;
  let match;
  while ((match = re.exec(text))) {
    const [, id, cell] = match;
    // В ячейке первым идёт слово с огласовками; дальше могут быть варианты.
    const vocalized = strip(cell).split(" ").find((w) => /[א-ת]/.test(w));
    if (!vocalized) continue;
    forms[id] = { vocalized, bare: vocalized.replace(NIQQUD, "") };
  }
  return forms;
}
