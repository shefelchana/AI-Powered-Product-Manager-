import { test } from "node:test";
import assert from "node:assert/strict";
import { affirmativeOf, negationExercises } from "./negation.js";

// «Сделай отрицание»: утвердительная версия предложения преподавателя показывается,
// эталон — оригинал с «לא»/«אין». Ничего не придумываем: только обратное преобразование.

test("«לא» убирается, остальное нетронуто", () => {
  assert.equal(affirmativeOf("הוא לא יכול להפר את החוזה שלו."), "הוא יכול להפר את החוזה שלו.");
  assert.equal(affirmativeOf("אני לא מבינה איך הוא העז."), "אני מבינה איך הוא העז.");
});

test("«אין» → «יש»; несколько «לא» — все убираются", () => {
  assert.equal(affirmativeOf("אין לי תחושת סיפוק בעבודה הזאת."), "יש לי תחושת סיפוק בעבודה הזאת.");
  assert.equal(affirmativeOf("הוא לא יכול, הוא לא הפר."), "הוא יכול, הוא הפר.");
});

test("без отрицания — null; «לא» внутри слова не трогается", () => {
  assert.equal(affirmativeOf("צריך לצמצם הוצאות."), null);
  assert.equal(affirmativeOf("הם למדו לאט."), null);     // לאט ≠ לא
  assert.equal(affirmativeOf(""), null);
  assert.equal(affirmativeOf(null), null);
});

test("огласованный текст: «לֹא» тоже узнаётся, ответ остаётся неогласованным оригиналом", () => {
  const ex = negationExercises([{ id: 1, he: "היא לא באה.", heVocalized: "הִיא לֹא בָּאָה.", ru: "Она не пришла.", audioUrl: "", lessonId: 3, wrongCount: 0 }]);
  assert.equal(ex.length, 1);
  assert.equal(ex[0].prompt, "היא באה.");
  assert.equal(ex[0].answer, "היא לא באה.");
  assert.equal(ex[0].answerVocalized, "הִיא לֹא בָּאָה.");
  // сверка как в строгом режиме: ответ ученицы без огласовок совпадает с эталоном
});

test("упражнение: kind negation, перевод и подпись, предложения без отрицания пропускаются", () => {
  const list = negationExercises([
    { id: 1, he: "הוא לא יכול להפר את החוזה.", ru: "Он не может нарушить договор.", lessonId: 2, wrongCount: 1 },
    { id: 2, he: "צריך לצמצם הוצאות.", ru: "Нужно сократить расходы.", lessonId: 2, wrongCount: 0 },
  ], { recentLessonId: 2 });
  assert.equal(list.length, 1);
  const ex = list[0];
  assert.equal(ex.kind, "negation");
  assert.equal(ex.sentenceId, 1);
  assert.equal(ex.formId, "negation");
  assert.equal(ex.translation, "Он не может нарушить договор.");
  assert.equal(ex.label, "отрицание");
  assert.equal(ex.recent, true);
  assert.equal(ex.wrong, true);
  assert.equal(ex.wordId, null);
});

test("мусор на входе — пусто", () => {
  assert.deepEqual(negationExercises(null), []);
  assert.deepEqual(negationExercises([{ he: 5 }, null]), []);
});

// Из ревью 15.09: подсказка не должна оставаться отрицательной или неграмотной.
test("приставочные и усиленные отрицания — не предлагаем (null)", () => {
  for (const he of ["אין לי כסף ולא זמן.", "הוא אף פעם לא בא.", "לא רק הוא בא, אלא גם היא.", "אני לא מבינה שלא באת.", "מעולם לא ראיתי.", "אין לי שום כוונה להסתכסך איתו.", "הוא לא בא בכלל.", "אל תלך, זה לא כדאי."]) {
    assert.equal(affirmativeOf(he), null, he);
  }
});

test("макаф остаётся, висячая запятая убирается, цитата «לא» не превращается в пустые кавычки", () => {
  assert.equal(affirmativeOf("אין לי בית־ספר."), "יש לי בית־ספר.");
  assert.equal(affirmativeOf("לא, זה נכון."), "זה נכון.");
  assert.equal(affirmativeOf('"לא" זה לא תשובה.'), null);
});

test("в подсказке никогда не остаётся отрицания — на реальном корпусе", () => {
  const corpus = ["הוא לא יכול להפר את החוזה שלו. הוא לא הפר את החוזה.", "אני לא מבינה איך הוא העז להפר את ההסכם.", "אין לי תחושת סיפוק בעבודה הזאת. אני שוקל לעזוב את העבודה.", "נראה לי שלא הענקתי לו מספיק תשומת לב.", "אני חושב שלא כדאי לשתף אותו בבעיות שלי.", "דבריו לא נכונים בלשון המעטה."];
  for (const he of corpus) {
    const p = affirmativeOf(he);
    if (p === null) continue;
    assert.ok(!/(^|\s)(לא|אין|ולא|שלא)(\s|$|[.,!?])/.test(p), `${he} → ${p}`);
  }
});

test("подсказка ученице: «אין → יש» или «добавь לא»; эталон — оригинал как есть", () => {
  const [ein] = negationExercises([{ id: 1, he: "אין לי זמן.", ru: "У меня нет времени." }]);
  assert.equal(ein.hint, "замени «יש» на «אין»");
  const [lo] = negationExercises([{ id: 2, he: "הוא לא בא.", ru: "Он не пришёл." }]);
  assert.equal(lo.hint, "добавь «לא»");
  assert.equal(lo.answer, "הוא לא בא.");
});
