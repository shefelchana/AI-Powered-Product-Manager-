// Строгое вспоминание: сначала пишешь ответ, потом видишь правильный.
// Здесь только чистые функции — их можно гонять тестами без браузера.

const NIQQUD = /[֑-ׇ]/g;
const FINAL_FORMS = { "ם": "מ", "ן": "נ", "ץ": "צ", "ף": "פ", "ך": "כ" };
const NOISE = /[\s.,!?;:"'׳״()\[\]{}\-–—]/g;

// Сравниваем по сути, а не по знакам: огласовки, пробелы, знаки препинания и
// конечные формы букв — не знание, а написание. При дислексии наказывать за них
// значит выключить режим на второй день.
export function normalize(text) {
  return String(text ?? "")
    .replace(NIQQUD, "")
    .replace(NOISE, "")
    .replace(/[םןץףך]/g, (letter) => FINAL_FORMS[letter])
    .toLowerCase();
}

export function matches(given, expected) {
  const left = normalize(given);
  return left.length > 0 && left === normalize(expected);
}

// Вопрос — своя фраза с дыркой на месте слова. Приставки (ה, ו, ב…) остаются
// видимыми: они показывают грамматику, а вписать надо чистую форму.
// Слово, которого нет в фразе дословно (изменённая форма), в строгий режим
// не попадает — угадывать, что именно вырезать, мы не беремся.
export function clozeFor(word) {
  const phrases = String(word?.examples ?? "").split("\n").filter(Boolean);
  const term = String(word?.term ?? "").trim();
  if (!term) return null;

  for (const phrase of phrases) {
    const at = phrase.indexOf(term);
    if (at !== -1) {
      return {
        prompt: phrase.slice(0, at) + "___" + phrase.slice(at + term.length),
        answer: term,
      };
    }
  }
  return null;
}
