import { test } from "node:test";
import assert from "node:assert/strict";
import { echoReduce, ECHO_START, micErrorKind, pickMimeType } from "./echo.js";

// «Эхо»: слушай → запиши → сравни → дальше. Одна кнопка за раз.

test("начало — слушаем эталон, записи нет", () => {
  assert.equal(ECHO_START.stage, "listen");
  assert.equal(ECHO_START.takes, 0);
});

test("record → recording, stop → compare с номером дубля", () => {
  const rec = echoReduce(ECHO_START, { type: "record" });
  assert.equal(rec.stage, "recording");
  const cmp = echoReduce(rec, { type: "stop" });
  assert.equal(cmp.stage, "compare");
  assert.equal(cmp.takes, 1);
});

test("again из compare — снова запись, дубли считаются", () => {
  const cmp = echoReduce(echoReduce(ECHO_START, { type: "record" }), { type: "stop" });
  const again = echoReduce(cmp, { type: "again" });
  assert.equal(again.stage, "recording");
  assert.equal(echoReduce(again, { type: "stop" }).takes, 2);
});

test("next — к началу для следующего предложения", () => {
  const cmp = echoReduce(echoReduce(ECHO_START, { type: "record" }), { type: "stop" });
  assert.deepEqual(echoReduce(cmp, { type: "next" }), ECHO_START);
});

test("микрофон запрещён — режим «только слушать», запись недоступна, дальше можно", () => {
  const nomic = echoReduce(ECHO_START, { type: "nomic", reason: "запрещён" });
  assert.equal(nomic.stage, "listen");
  assert.equal(nomic.mic, false);
  assert.equal(echoReduce(nomic, { type: "record" }).stage, "listen");
  assert.equal(echoReduce(nomic, { type: "next" }).mic, false);
});

test("невозможные переходы ничего не ломают", () => {
  assert.equal(echoReduce(ECHO_START, { type: "stop" }).stage, "listen");
  assert.equal(echoReduce(ECHO_START, { type: "again" }).stage, "listen");
  assert.equal(echoReduce(ECHO_START, { type: "wat" }).stage, "listen");
});

// Из ревью 15.09: временный сбой не должен запирать микрофон на весь подход.
test("временный сбой (микрофон занят) — сообщение, но запись остаётся доступной", () => {
  const rec = echoReduce(ECHO_START, { type: "record" });
  const s = echoReduce(rec, { type: "micfail", reason: "занят" });
  assert.equal(s.stage, "listen");
  assert.equal(s.mic, true);
  assert.match(s.note, /занят/);
  assert.equal(echoReduce(s, { type: "record" }).stage, "recording");
  assert.equal(echoReduce(echoReduce(s, { type: "record" }), { type: "stop" }).note, "");
});

test("пустая запись — не дубль: остаёмся где были и просим повторить", () => {
  const rec = echoReduce(ECHO_START, { type: "record" });
  const s = echoReduce(rec, { type: "empty" });
  assert.equal(s.stage, "listen");
  assert.equal(s.takes, 0);
  assert.match(s.note, /коротко/);
  const cmp = echoReduce(rec, { type: "stop" });
  const s2 = echoReduce(echoReduce(cmp, { type: "again" }), { type: "empty" });
  assert.equal(s2.stage, "compare");
  assert.equal(s2.takes, 1);
});

test("ошибки микрофона: запрет и отсутствие — навсегда, остальное — на этот раз", () => {
  assert.equal(micErrorKind({ name: "NotAllowedError" }).permanent, true);
  assert.equal(micErrorKind({ name: "NotFoundError" }).permanent, true);
  assert.equal(micErrorKind({ name: "NotReadableError" }).permanent, false);
  assert.equal(micErrorKind(new Error("x")).permanent, false);
  assert.equal(micErrorKind(null).permanent, false);
});

test("формат записи: первый поддерживаемый, иначе пусто", () => {
  assert.equal(pickMimeType((t) => t === "audio/mp4"), "audio/mp4");
  assert.equal(pickMimeType((t) => t.startsWith("audio/webm")), "audio/webm;codecs=opus");
  assert.equal(pickMimeType(() => false), "");
  assert.equal(pickMimeType(undefined), "");
  assert.equal(pickMimeType(() => { throw new Error("no"); }), "");
});
