// «Эхо»: слушай → запиши → сравни → дальше. Чистый редьюсер, чтобы этапы
// были проверяемы без браузера. Микрофона нет совсем (запрещён/не найден) —
// остаёмся в «слушай и повторяй вслух»; временный сбой — сообщение, но попытки можно повторять.
export const ECHO_START = Object.freeze({ stage: "listen", takes: 0, mic: true, note: "" });
export const MAX_TAKE_SECONDS = 20;

export function echoReduce(state, action) {
  const s = state ?? ECHO_START;
  switch (action?.type) {
    case "nomic":
      return { ...s, stage: "listen", mic: false, note: action.reason ? `Микрофон недоступен (${action.reason}) — слушай и повторяй вслух` : "Микрофон недоступен — слушай и повторяй вслух" };
    case "micfail":
      return { ...s, stage: s.stage === "recording" ? "listen" : s.stage, note: action.reason ? `Запись не удалась (${action.reason}) — попробуй ещё раз` : "Запись не удалась — попробуй ещё раз" };
    case "record":
      return s.mic && (s.stage === "listen" || s.stage === "compare") ? { ...s, stage: "recording", note: "" } : s;
    case "stop":
      return s.stage === "recording" ? { ...s, stage: "compare", takes: s.takes + 1, note: "" } : s;
    case "empty":
      return s.stage === "recording" ? { ...s, stage: s.takes > 0 ? "compare" : "listen", note: "Слишком коротко — попробуй ещё раз" } : s;
    case "again":
      return s.stage === "compare" ? { ...s, stage: "recording", note: "" } : s;
    case "next":
      return { ...ECHO_START, mic: s.mic, note: s.mic ? "" : s.note };
    default:
      return s;
  }
}

// Какой формат записи умеет этот браузер (Safari — mp4, Chrome/Firefox — webm/ogg).
export function pickMimeType(isSupported) {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];
  return types.find((t) => { try { return Boolean(isSupported?.(t)); } catch { return false; } }) ?? "";
}

// Ошибка getUserMedia: навсегда (нет разрешения/устройства) или на этот раз.
export function micErrorKind(error) {
  const name = String(error?.name ?? "");
  if (name === "NotAllowedError" || name === "SecurityError") return { permanent: true, reason: "доступ запрещён" };
  if (name === "NotFoundError" || name === "OverconstrainedError") return { permanent: true, reason: "микрофон не найден" };
  if (name === "NotReadableError") return { permanent: false, reason: "микрофон занят другой программой" };
  return { permanent: false, reason: "не удалось включить" };
}
