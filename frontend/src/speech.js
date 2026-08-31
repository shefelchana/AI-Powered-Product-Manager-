// Озвучка встроенным синтезом браузера: ни ключей, ни внешних сервисов.
const LOCALES = { he: "he-IL", en: "en-US", ru: "ru-RU" };

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

// Список голосов приезжает асинхронно: при первом вызове он часто пуст,
// браузер досылает его событием voiceschanged.
let cache = [];

function refresh() {
  if (canSpeak()) cache = window.speechSynthesis.getVoices();
}

if (canSpeak()) {
  refresh();
  window.speechSynthesis.addEventListener("voiceschanged", refresh);
}

// Компактные системные голоса звучат механически. Улучшенные (Enhanced,
// Premium, Siri) ставятся отдельно и звучат заметно живее — предпочитаем их.
const quality = (voice) => (/premium|enhanced|siri/i.test(voice.name) ? 2 : 0) + (voice.localService ? 1 : 0);

export function voicesFor(lang) {
  const prefix = (LOCALES[lang] ?? LOCALES.he).slice(0, 2);
  return cache
    .filter((voice) => voice.lang.toLowerCase().startsWith(prefix))
    .sort((a, b) => quality(b) - quality(a));
}

export function speak(text, lang = "he", voiceName = "") {
  if (!canSpeak()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LOCALES[lang] ?? LOCALES.he;

  const available = voicesFor(lang);
  const chosen = available.find((voice) => voice.name === voiceName) ?? available[0];
  if (chosen) utterance.voice = chosen;

  // 0.85 звучало искусственно замедленным; чуть ниже обычной — разборчиво,
  // но без роботизированного растягивания.
  utterance.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
