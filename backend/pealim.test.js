import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTitle } from "./pealim.js";

test("из заголовка берутся слово и значение", () => {
  const entry = parseTitle("להזדרז – to hurry up, to hustle – Hebrew conjugation tables");
  assert.equal(entry.term, "להזדרז");
  assert.equal(entry.meaning, "to hurry up, to hustle");
});

test("второй реальный заголовок разбирается так же", () => {
  const entry = parseTitle("להדגיש – to emphasise, to stress – Hebrew conjugation tables");
  assert.equal(entry.meaning, "to emphasise, to stress");
});

test("экранированные сущности раскрываются", () => {
  const entry = parseTitle("לומר – to say &quot;yes&quot; – Hebrew conjugation tables");
  assert.equal(entry.meaning, 'to say "yes"');
});

// Дефис вместо длинного тире, одна часть вместо трёх, пустой ввод — всё это
// «данных нет». Частичный объект возвращать нельзя: правдоподобное, но неверное
// значение хуже отсутствия значения.
test("заголовок с обычным дефисом не разбирается", () => {
  assert.equal(parseTitle("להזדרז - to hurry up - Hebrew conjugation tables"), null);
});

test("заголовок без второго тире не разбирается", () => {
  assert.equal(parseTitle("להזדרז – to hurry up"), null);
});

test("пустое значение между тире не считается данными", () => {
  assert.equal(parseTitle("להזדרז –  – Hebrew conjugation tables"), null);
});

test("пустой и отсутствующий ввод не ломают разбор", () => {
  assert.equal(parseTitle(""), null);
  assert.equal(parseTitle(null), null);
});

// Сверку найденного слова с запрошенным тестируем через экспортируемую bare-логику
// косвенно: сам lookupPealim ходит в сеть, поэтому здесь проверяем только разбор.
// Живая проверка на бессмыслице «קשקוש123» зафиксирована в отчёте задачи.
