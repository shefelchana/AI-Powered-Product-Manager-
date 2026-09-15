import { test } from "node:test";
import assert from "node:assert/strict";
import { listenState } from "./listen.js";

// «Слушать до текста»: диктант начинается с прослушиваний без поля ввода.
// Подсказка меняется по числу удавшихся воспроизведений; писать можно после первого.

test("ничего не прозвучало (autoplay заблокирован) — писать нельзя, просят нажать", () => {
  const s = listenState(0);
  assert.equal(s.canWrite, false);
  assert.match(s.hint, /нажми|послушай/i);
});

test("после первого прослушивания — предлагают ещё раз, но писать уже можно", () => {
  const s = listenState(1);
  assert.equal(s.canWrite, true);
  assert.match(s.hint, /ещё раз/i);
});

test("после второго — можно ещё раз или писать", () => {
  const s = listenState(2);
  assert.equal(s.canWrite, true);
  assert.match(s.hint, /писать/i);
});

test("с третьего — хватит слушать", () => {
  for (const n of [3, 4, 10]) {
    const s = listenState(n);
    assert.equal(s.canWrite, true);
    assert.match(s.hint, /пиши/i);
  }
});

test("счётчик не ломается от мусора", () => {
  assert.equal(listenState(undefined).canWrite, false);
  assert.equal(listenState(-1).canWrite, false);
  assert.equal(listenState("2").canWrite, true);
});
