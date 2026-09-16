import { test } from "node:test";
import assert from "node:assert/strict";
import { missHint, normalize } from "./hints.js";
import { missHint as frontHint, normalize as frontNormalize } from "../frontend/src/recall.js";

// Близнецы: серверная подсказка должна давать ровно то же, что фронтендовая.
const PAIRS = [["הכיטה", "הכיתה"], ["אחר", "אחד"], ["לגעתי", "לדעתי"], ["המטעה", "המעטה"], ["מהפרה", "מפרה"], ["התבגרות", "ההתבגרות"], ["שלום", "שלום"], ["", "x"], ["מִלָּה", "מילה"], ["סכסוך", "סכסוך"], ["חכמה", "כחמה"], ["לאזוב", "לעזוב"]];
test("серверная и фронтендовая подсказки совпадают на наборе пар", () => {
  for (const [g, e] of PAIRS) {
    assert.equal(missHint(g, e), frontHint(g, e), `${g} / ${e}`);
    assert.equal(normalize(g), frontNormalize(g));
  }
});
