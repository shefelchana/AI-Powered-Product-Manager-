// «Эхо»: слушай → запиши → сравни → дальше. Чистый редьюсер, чтобы этапы
// были проверяемы без браузера. Микрофона нет — остаёмся в «слушай и повторяй вслух».
export const ECHO_START = Object.freeze({ stage: "listen", takes: 0, mic: true, note: "" });

export function echoReduce(state, action) {
  const s = state ?? ECHO_START;
  switch (action?.type) {
    case "nomic":
      return { ...s, stage: "listen", mic: false, note: action.reason ? `Микрофон недоступен (${action.reason}) — слушай и повторяй вслух` : "Микрофон недоступен — слушай и повторяй вслух" };
    case "record":
      return s.mic && (s.stage === "listen" || s.stage === "compare") ? { ...s, stage: "recording" } : s;
    case "stop":
      return s.stage === "recording" ? { ...s, stage: "compare", takes: s.takes + 1 } : s;
    case "again":
      return s.stage === "compare" ? { ...s, stage: "recording" } : s;
    case "next":
      return { ...ECHO_START, mic: s.mic, note: s.note };
    default:
      return s;
  }
}
