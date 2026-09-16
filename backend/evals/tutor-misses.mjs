// Evals тьютора на реальных промахах (fixtures/tutor-misses.json). Запуск руками с ключом:
//   GEMINI_API_KEY=… node evals/tutor-misses.mjs
// Метрики: доля верного типа (главный или допустимый), отдельно по «binyan» и «not_an_error»,
// доля отказов валидатора (галлюцинации about, длина, язык). Порог включения: ≥ 80 % по типу, 0 галлюцинаций.
import fs from "node:fs";
import { classifyDeterministic, buildMissPrompt, validateMiss, askGemini, MISS_SCHEMA } from "../tutor.js";

const fx = JSON.parse(fs.readFileSync(new URL("../fixtures/tutor-misses.json", import.meta.url), "utf-8"));
const only = process.argv[2] === "--rules-only";
let correct = 0, byRule = 0, invalid = 0, modelCalls = 0, modelCorrect = 0;
const perClass = {};
const rows = [];
for (const item of fx.items) {
  let r = classifyDeterministic(item);
  let source = "rule";
  if (r) byRule += 1;
  else if (only) { rows.push([item.id, "—", "skip", item.expectedTypes.join("/")]); continue; }
  else {
    source = "model"; modelCalls += 1;
    try {
      const raw = await askGemini({ prompt: buildMissPrompt(item), schema: MISS_SCHEMA });
      const v = validateMiss(raw, item);
      if (!v.ok) { invalid += 1; rows.push([item.id, "model", `INVALID: ${v.reason}`, item.expectedTypes.join("/"), JSON.stringify(raw).slice(0, 120)]); continue; }
      r = v.value;
    } catch (e) { invalid += 1; rows.push([item.id, "model", `ERROR: ${e.message}`, item.expectedTypes.join("/")]); continue; }
    await new Promise((res) => setTimeout(res, 3000));
  }
  const got = r.verdict === "not_an_error" ? "not_an_error" : r.type;
  const ok = item.expectedTypes.includes(got);
  if (ok) correct += 1;
  if (ok && source === "model") modelCorrect += 1;
  const main = item.expectedTypes[0];
  perClass[main] = perClass[main] || { n: 0, ok: 0 };
  perClass[main].n += 1; if (ok) perClass[main].ok += 1;
  rows.push([item.id, source, ok ? "ok" : "MISS", `${got} vs ${item.expectedTypes.join("/")}`, r.about, (r.why || "").slice(0, 90)]);
}
for (const row of rows) console.log(row.join(" | "));
const total = only ? byRule : fx.items.length;
console.log(`\nправилом: ${byRule}, моделью: ${modelCalls}, верно всего: ${correct}/${total} (${Math.round((100 * correct) / total)}%), отказов валидатора: ${invalid}`);
if (modelCalls) console.log(`ворота — только модель: ${modelCorrect}/${modelCalls} (${Math.round((100 * modelCorrect) / modelCalls)}%), порог 80%`);
console.log("по классам:", Object.entries(perClass).map(([k, v]) => `${k} ${v.ok}/${v.n}`).join(", "));
