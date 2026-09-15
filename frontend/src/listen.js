// «Слушать до текста»: диктант начинается с прослушиваний без поля ввода.
// Счётчик — только удавшиеся воспроизведения (autoplay браузер может заблокировать).
// Писать можно после первого; подсказка мягко ведёт ко второму-третьему разу,
// как в схеме «сначала послушать 2–4 раза, следить за тем, что понятно».
export function listenState(plays) {
  const n = Math.max(0, Math.floor(Number(plays)) || 0);
  if (n === 0) return { stage: "silent", canWrite: false, hint: "Нажми и послушай. Не застревай на незнакомом — следи за тем, что понятно" };
  if (n === 1) return { stage: "once", canWrite: true, hint: "Ещё раз: со второго прослушивания понимание распаковывается" };
  if (n === 2) return { stage: "twice", canWrite: true, hint: "Можно ещё раз — или писать" };
  return { stage: "enough", canWrite: true, hint: "Хватит слушать — пиши" };
}

// Этап единицы практики. Прослушивание есть только у диктанта, до ответа и до
// нажатия «Написать». Если звук не загрузился — не запирать: разрешить писать и сказать об этом.
export function dictationStage({ kind, writing = false, result = null, plays = 0, audioFailed = false }) {
  if (kind !== "dictation" || result !== null || writing) return { listening: false, canWrite: true, stage: "off", hint: "" };
  if (audioFailed) return { listening: true, canWrite: true, stage: "failed", hint: "Звук не загрузился. Нажми ещё раз, напиши по памяти или пропусти" };
  return { listening: true, ...listenState(plays) };
}
