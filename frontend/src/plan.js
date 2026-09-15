// «Неделя одного урока»: один шаг на сегодня для экрана дня (Анна, 15.09: только «сегодня»).
// Уроки по понедельникам и средам. Просроченные слова — всегда первым делом; план — строкой «потом».
// Отсчёт от последнего урока: день урока — «Эхо»; накануне урока — «Повторить урок»;
// между ними чередуются «Фразы» (нечётный день) и «Эхо» (чётный).
export const LESSON_WEEKDAYS = [1, 3]; // 0 — воскресенье

const STEPS = {
  echo: { action: "echo", title: "Эхо: повтори за преподавателем", hint: "6 предложений урока вслух — слушай, записывай, сравнивай" },
  practice: { action: "practice", title: "Фразы: диктанты, формы, отрицания", hint: "10 единиц из предложений урока и глаголов" },
  prep: { action: "prep", title: "Повторить урок — завтра занятие", hint: "Слова прошлого урока строгим режимом, без записи в расписание" },
};

const dayOf = (iso) => new Date(`${iso}T00:00:00Z`);
const isoDate = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

function daysBetween(fromIso, toIso) {
  return Math.round((dayOf(toIso) - dayOf(fromIso)) / 86400000);
}

export function todayStep({ dueCount = 0, lessons = [], today, lessonWords = 0 } = {}) {
  const todayIso = isoDate(today) ?? new Date().toISOString().slice(0, 10);
  const dates = (Array.isArray(lessons) ? lessons : []).map((l) => isoDate(l?.date)).filter((d) => d && d <= todayIso).sort();
  const last = dates[dates.length - 1] ?? null;
  const tomorrowIsLesson = LESSON_WEEKDAYS.includes((dayOf(todayIso).getUTCDay() + 1) % 7);

  let plan;
  if (!last) plan = STEPS.practice;
  else {
    const days = daysBetween(last, todayIso);
    if (days === 0) plan = STEPS.echo;
    else if (tomorrowIsLesson) plan = lessonWords > 0 ? STEPS.prep : STEPS.practice;
    else plan = days % 2 === 1 ? STEPS.practice : STEPS.echo;
  }
  const due = Number(dueCount) || 0;
  if (due > 0) {
    return { action: "reviewmenu", title: `Повторить: ${due} ${plural(due)}`, hint: "Сначала расписание — это держит слова в памяти", then: plan };
  }
  return { ...plan, then: null };
}

function plural(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "слово";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "слова";
  return "слов";
}
