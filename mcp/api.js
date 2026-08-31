// Тонкая обёртка над боевым API приложения. MCP-сервер крутится локально,
// а данные берёт с Render — значит слово, добавленное из чата, сразу видно
// в приложении на телефоне.
const BASE = process.env.VOCAB_API_URL ?? "https://ai-workshop-web-bqvc.onrender.com";
const TIMEOUT_MS = 60000; // бесплатный тариф Render засыпает: первый запрос долгий

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`Приложение недоступно (${BASE}): ${error.message}`);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Пустой ответ — ошибку определяем по коду.
  }
  if (!res.ok) {
    const error = new Error(data?.error ?? `Сервер ответил ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

const json = (method, body) => ({ method, body: JSON.stringify(body) });

export const listWords = () => request("/api/words");
export const dueWords = (limit, lang) => request(`/api/words/due?limit=${limit}&lang=${lang}`);
export const createWord = (word) => request("/api/words", json("POST", word));
export const addExample = (id, text) => request(`/api/words/${id}/examples`, json("POST", { text }));
export const askAcademy = (id, href) =>
  request(`/api/words/${id}/academy`, json("POST", href ? { href } : {}));

// Агент знает слова по написанию, а не по номеру. Поиск ведём по точному
// совпадению, иначе можно молча поправить не то слово.
export async function findByTerm(term) {
  const words = await listWords();
  const wanted = String(term).trim();
  return words.find((word) => word.term === wanted) ?? null;
}

export { BASE };
