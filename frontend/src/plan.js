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

// Приветствие с поддержкой (Анна, 16.09): по времени суток и по одному настоящему факту из данных —
// без стриков и без давления. Один факт, одна фраза.
export function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", hour: "numeric", hourCycle: "h23" }).format(now)) % 24;
  if (h >= 5 && h < 12) return "Доброе утро, Аня";
  if (h >= 12 && h < 18) return "Добрый день, Аня";
  if (h >= 18 && h < 23) return "Добрый вечер, Аня";
  return "Привет, Аня";
}

// Сайт: по дням (классная и домашняя одной даты — вместе), только дни с ≥ 5 отвеченными.
export function siteByDay(site) {
  const byDate = new Map();
  for (const s of Array.isArray(site) ? site : []) {
    const d = byDate.get(s.date) ?? { date: s.date, answered: 0, wrong: 0 };
    d.answered += Number(s.answered) || 0; d.wrong += Number(s.wrong) || 0;
    byDate.set(s.date, d);
  }
  return [...byDate.values()].filter((d) => d.answered >= 5).sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((d) => ({ ...d, pct: Math.round((100 * d.wrong) / d.answered) }));
}

const dayWord = (n) => (n === 1 ? "день" : n >= 2 && n <= 4 ? "дня" : "дней");

export function supportLine({ dueCount = 0, activeDays = 0, learned = 0, site = [], lessonWords = 0, seed = new Date().getDate() } = {}) {
  const trend = siteByDay(site);
  if (trend.length >= 2) {
    const [a, b] = trend.slice(-2);
    if (b.pct < a.pct) return `На сайте ошибок стало меньше: ${a.pct}% → ${b.pct}%. Это твоя работа, не случайность.`;
    if (b.pct > a.pct) return `Последнее задание было труднее (${a.pct}% → ${b.pct}%). Это нормально: новые слова сначала ломаются.`;
  }
  // Остальные факты чередуются по дням, чтобы фраза не была одной и той же неделями.
  const lines = [];
  if (learned > 0) lines.push(`Уже ${learned} ${plural(learned)} вспомнились через две недели — это результат.`);
  if (activeDays >= 3) lines.push(`Ты занималась ${activeDays} ${dayWord(activeDays)} за две недели. Ритм есть.`);
  if (dueCount === 0) lines.push("Расписание чистое. Можно просто послушать эхо и ничего не писать.");
  if (lessonWords > 0) lines.push(`Слов с урока: ${lessonWords}. Не все сразу — сегодня хватит и ${Math.min(lessonWords, 5)}.`);
  if (lines.length === 0) return "Одно слово за раз. Этого достаточно.";
  return lines[Math.abs(Number(seed) || 0) % lines.length];
}
