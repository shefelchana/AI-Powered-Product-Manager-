// Озвучка встроенным синтезом браузера: ни ключей, ни внешних сервисов.
// Голоса зависят от устройства — если ивритского нет, кнопку не показываем.
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

const VOICES = { he: "he-IL", en: "en-US", ru: "ru-RU" };

export function speak(text, lang = "he") {
  if (!canSpeak()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  // Голос по языку слова: ивритским голосом «merger» читается кашей.
  utterance.lang = VOICES[lang] ?? VOICES.he;
  utterance.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
