import { test } from "node:test";
import assert from "node:assert/strict";
import { bareTerm } from "./terms.js";

test("огласовки снимаются при сохранении слова, пробелы схлопываются", () => {
  assert.equal(bareTerm("שָׁלוֹם"), "שלום");
  assert.equal(bareTerm("  לְהָקִים   עַל "), "להקים על");
  assert.equal(bareTerm("merger"), "merger");
  assert.equal(bareTerm(null), "");
  assert.equal(bareTerm("א".repeat(300)).length, 200);
});
