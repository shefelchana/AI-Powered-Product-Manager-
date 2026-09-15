import { test } from "node:test";
import assert from "node:assert/strict";
import { echoReduce, ECHO_START } from "./echo.js";

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
