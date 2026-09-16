// Прогресс — чистая функция над словами, журналом ответов и попытками практики.
// Никаких стриков: только что держится, что нет, и в какие дни повторяли.
import { FORM_LABELS } from "./conjugation.js";
import { localToday, dayOffsetFrom } from "./schedule.js";

export const STAGE_NAMES = { new: "новое", day1: "через день", day3: "через 3 дня", week: "через неделю", settling: "закрепляется", learned: "выучено" };
const RETENTION_BOX = 4;
// Один промах у нового слова — норма. «Не держится» — от двух.
const HARD_MISSES = 2; // коробка ≥ 4 перед ответом = слово вернулось после ≥ 7 дней

export function progressReport(words, attempts, lessons, practice, now = new Date()) {
  const list = Array.isArray(words) ? words : [];
  const log = Array.isArray(attempts) ? attempts : [];

  // Выучено = была верная попытка, когда слово уже стояло в пятой коробке
  // (то есть вспомнилось через 16 дней). Пятая без такой попытки — закрепляется.
  const learnedIds = new Set(log.filter((a) => a.known && Number(a.boxBefore) >= 5).map((a) => a.wordId));
  const stages = { new: 0, day1: 0, day3: 0, week: 0, settling: 0, learned: 0 };
  const stageOf = (w) => {
    const box = Number(w.box) || 1;
    if (box >= 5) return learnedIds.has(w.id) ? "learned" : "settling";
    return { 1: "new", 2: "day1", 3: "day3", 4: "week" }[box] ?? "new";
  };
  for (const w of list) stages[stageOf(w)] += 1;

  const retained = log.filter((a) => Number(a.boxBefore) >= RETENTION_BOX);
  const retention = { asked: retained.length, correct: retained.filter((a) => a.known).length };

  const hard = list
    .filter((w) => Number(w.misses) >= HARD_MISSES)
    .sort((a, b) => Number(b.misses) - Number(a.misses) || a.id - b.id)
    .slice(0, 5)
    .map((w) => ({ id: w.id, term: w.term, translation: w.translation ?? "", misses: Number(w.misses) }));

  const byLesson = (Array.isArray(lessons) ? lessons : []).map((l) => {
    const ws = list.filter((w) => w.lessonId === l.id);
    return {
      id: l.id,
      title: l.title || "",
      date: l.date,
      total: ws.length,
      holding: ws.filter((w) => Number(w.box) >= 3).length,
      learned: ws.filter((w) => learnedIds.has(w.id)).length,
    };
  }).filter((l) => l.total > 0);

  const days = new Set(log.map((a) => localToday(new Date(a.createdAt))));
  const activeDays = Array.from({ length: 14 }, (_, i) => {
    const date = dayOffsetFrom(now, i - 13);
    return { date, active: days.has(date) };
  });

  const formStats = new Map();
  for (const p of Array.isArray(practice) ? practice : []) {
    if (!p.formId) continue;
    const s = formStats.get(p.formId) ?? { formId: p.formId, asked: 0, correct: 0 };
    s.asked += 1; if (p.ok) s.correct += 1;
    formStats.set(p.formId, s);
  }
  const forms = [...formStats.values()].map((s) => ({
    ...s,
    label: FORM_LABELS[s.formId]?.ru ?? (s.formId.includes(":") ? s.formId.replace(":", " + ") : s.formId),
  }));

  // Сайт ульпана: доля ошибок по заданиям, по датам — единственная внешняя мера.
  const site = (Array.isArray(lessons) ? lessons : [])
    .filter((l) => Number(l.siteAnswered) > 0)
    .map((l) => ({ id: l.id, date: l.date, title: l.title || "", answered: Number(l.siteAnswered), wrong: Number(l.siteWrong) || 0, pct: Math.round((100 * (Number(l.siteWrong) || 0)) / Number(l.siteAnswered)) }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id);
  return { stages, learnedIds: [...learnedIds], retention, hard, lessons: byLesson, activeDays, forms, site };
}
