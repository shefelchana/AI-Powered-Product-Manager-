// «Неделя одного урока»: один шаг на сегодня для экрана дня (Анна, 15.09: только «сегодня»).
// Уроки по понедельникам и средам. Просроченные слова — всегда первым делом; план — строкой «потом».
// Отсчёт от последнего урока (того же, что показывает «К уроку»): день урока — «Эхо»; накануне
// урока — «Повторить урок»; между ними чередуются «Фразы» (нечётный день) и «Эхо» (чётный).
// Перерыв дольше недели (праздники) — накануне не считаем: урока, скорее всего, нет.
export const LESSON_WEEKDAYS = [1, 3]; // 0 — воскресенье
export const ACTIONS = ["reviewmenu", "echo", "practice", "prep"];

const STEPS = {
  echo: { action: "echo", title: "Эхо: повтори за преподавателем", short: "эхо за преподавателем", button: "Открыть эхо", hint: "6 предложений урока вслух — слушай, записывай, сравнивай" },
  practice: { action: "practice", title: "Фразы: диктанты, формы, отрицания", short: "фразы", button: "Открыть фразы", hint: "10 единиц из предложений урока и глаголов" },
  prep: { action: "prep", title: "Повторить урок — завтра занятие", short: "повторить урок к завтра", button: "Повторить урок", hint: "Слова прошлого урока строгим режимом, без записи в расписание" },
};

const dayOf = (iso) => new Date(`${iso}T00:00:00Z`);
const isoDate = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
// Сегодня — по Иерусалиму, как и расписание уроков; не по часовому поясу браузера.
export const todayInIsrael = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const daysBetween = (fromIso, toIso) => Math.round((dayOf(toIso) - dayOf(fromIso)) / 86400000);

export function todayStep({ dueCount = 0, lessonDate = null, today = null, lessonWords = 0 } = {}) {
  const todayIso = isoDate(today) ?? todayInIsrael();
  const last = isoDate(lessonDate);
  const days = last && last <= todayIso ? daysBetween(last, todayIso) : null;
  const tomorrowIsLesson = LESSON_WEEKDAYS.includes((dayOf(todayIso).getUTCDay() + 1) % 7);

  let plan;
  if (days === null) plan = STEPS.practice;
  else if (days === 0) plan = STEPS.echo;
  else if (tomorrowIsLesson && days <= 6) plan = lessonWords > 0 ? STEPS.prep : STEPS.practice;
  else plan = days % 2 === 1 ? STEPS.practice : STEPS.echo;

  const due = Number(dueCount) || 0;
  if (due > 0) {
    return { action: "reviewmenu", title: `Повторить: ${due} ${plural(due)}`, short: "повторение", button: "Повторять", hint: "Сначала расписание — это держит слова в памяти", then: plan };
  }
  return { ...plan, then: null };
}

export function plural(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "слово";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "слова";
  return "слов";
}
