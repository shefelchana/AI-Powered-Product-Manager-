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
