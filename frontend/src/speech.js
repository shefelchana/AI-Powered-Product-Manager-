// Озвучка встроенным синтезом браузера: ни ключей, ни внешних сервисов.
// Голоса зависят от устройства — если ивритского нет, кнопку не показываем.
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

export function speak(text) {
  if (!canSpeak()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "he-IL";
  utterance.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
