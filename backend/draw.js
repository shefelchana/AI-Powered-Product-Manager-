// Рисование образа к слову.
//
// Зачем вообще: метод, на котором построена колода, требует своего яркого
// образа. Для конкретных существительных его находит поиск картинок, а для
// абстрактных глаголов («отчаиваться», «подчёркивать») поиск не даёт ничего
// пригодного — там генерация уместнее живого поиска.
//
// Ключ берётся из окружения и в код не попадает.
const MODEL = process.env.IMAGE_MODEL ?? "gemini-2.5-flash-image";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 180000;

// В образе не должно быть букв: модель не пишет на иврите правильно, а неверная
// надпись на карточке хуже отсутствия надписи.
export function buildPrompt(word) {
  const meaning = [word.definition, word.translation].filter(Boolean).join(". ");
  return [
    "Illustration for a language flashcard.",
    meaning ? `It should depict: ${meaning}.` : "",
    "One clear scene, memorable, simple.",
    "No text, no letters, no words, no captions anywhere in the image.",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function drawImage(word) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const error = new Error("Ключ GEMINI_API_KEY не задан на сервере");
    error.code = "no_key";
    throw error;
  }

  let res;
  try {
    res = await fetch(`${ENDPOINT}/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: buildPrompt(word) }] }] }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    const error = new Error(`Не удалось обратиться к модели: ${cause.message}`);
    error.code = "unreachable";
    throw error;
  }

  if (res.status === 429) {
    const error = new Error(
      "Квота на генерацию изображений исчерпана. Нужен тариф с оплатой или другой ключ."
    );
    error.code = "quota";
    throw error;
  }
  if (!res.ok) {
    const error = new Error(`Модель ответила ${res.status}`);
    error.code = "http";
    throw error;
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData ?? part.inline_data;
    if (inline?.data) {
      return {
        bytes: Buffer.from(inline.data, "base64"),
        mime: inline.mimeType ?? inline.mime_type ?? "image/png",
      };
    }
  }

  // Модель ответила текстом вместо картинки — это не картинка, и подставлять
  // вместо неё нечего.
  const error = new Error("Модель вернула ответ без изображения");
  error.code = "no_image";
  throw error;
}
