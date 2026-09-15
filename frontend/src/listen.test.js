import { test } from "node:test";
import assert from "node:assert/strict";
import { audioSrc, dictationStage, listenState } from "./listen.js";

// «Слушать до текста»: диктант начинается с прослушиваний без поля ввода.
// Подсказка меняется по числу удавшихся воспроизведений; писать можно после первого.

test("ничего не прозвучало (autoplay заблокирован) — писать нельзя", () => {
  const s = listenState(0);
  assert.equal(s.stage, "silent");
  assert.equal(s.canWrite, false);
});

test("после первого прослушивания — предлагают ещё раз, но писать уже можно", () => {
  assert.deepEqual([listenState(1).stage, listenState(1).canWrite], ["once", true]);
});

test("после второго — можно ещё раз или писать; с третьего — хватит слушать", () => {
  assert.equal(listenState(2).stage, "twice");
  for (const n of [3, 4, 10]) assert.equal(listenState(n).stage, "enough");
});

test("счётчик не ломается от мусора", () => {
  assert.equal(listenState(undefined).canWrite, false);
  assert.equal(listenState(-1).canWrite, false);
  assert.equal(listenState("2").canWrite, true);
});

test("подсказки — разные и не пустые", () => {
  const hints = [0, 1, 2, 3].map((n) => listenState(n).hint);
  assert.equal(new Set(hints).size, 4);
  assert.ok(hints.every((h) => h.length > 10));
});

// Этап всей единицы: где именно показывать прослушивание.

test("не диктант — прослушивания нет никогда", () => {
  for (const kind of ["form", "preposition", "sentence"]) {
    assert.equal(dictationStage({ kind, plays: 0 }).listening, false);
    assert.equal(dictationStage({ kind, plays: 0 }).canWrite, true);
  }
});

test("диктант: слушаем, пока не нажали «Написать» и нет ответа", () => {
  assert.equal(dictationStage({ kind: "dictation", plays: 1 }).listening, true);
  assert.equal(dictationStage({ kind: "dictation", plays: 1, writing: true }).listening, false);
  assert.equal(dictationStage({ kind: "dictation", plays: 1, result: "ok" }).listening, false);
  assert.equal(dictationStage({ kind: "dictation", plays: 0, result: "gaveup" }).listening, false);
});

test("диктант: без удавшегося воспроизведения «Написать» не даём", () => {
  assert.equal(dictationStage({ kind: "dictation", plays: 0 }).canWrite, false);
  assert.equal(dictationStage({ kind: "dictation", plays: 1 }).canWrite, true);
});

test("звук не загрузился — не запираем: писать можно, причина названа", () => {
  const s = dictationStage({ kind: "dictation", plays: 0, audioFailed: true });
  assert.equal(s.listening, true);
  assert.equal(s.canWrite, true);
  assert.equal(s.stage, "failed");
  assert.match(s.hint, /не загрузился/);
});

// Пойманный баг 15.09: своя запись (blob:) получала префикс хранилища ульпана и не играла.
test("адрес звука: имя файла — из хранилища ульпана, полные адреса и blob: — как есть", () => {
  assert.equal(audioSrc("abc.mp3"), "https://hebreway-hadash.s3.eu-central-1.amazonaws.com/sentences-audio/abc.mp3");
  assert.equal(audioSrc("https://x.test/a.mp3"), "https://x.test/a.mp3");
  assert.equal(audioSrc("blob:http://localhost/123"), "blob:http://localhost/123");
  assert.equal(audioSrc("data:audio/webm;base64,AAA"), "data:audio/webm;base64,AAA");
});
