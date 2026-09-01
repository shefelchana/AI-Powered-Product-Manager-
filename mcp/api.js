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

  const body = await res.text();
  let data = null;
  if (body) {
    try {
      data = JSON.parse(body);
    } catch {
      // Ответ есть, но это не JSON. Так выглядит промах мимо API: страница
      // приложения отдаётся со статусом 200 на неизвестный путь. Молчать нельзя —
      // иначе инструмент вернёт null и упадёт где-то дальше без объяснения.
      throw new Error(
        `Ответ от ${BASE}${path} — не JSON (${res.status}). Похоже, эндпоинта там нет: ` +
          "проверь, задеплоена ли текущая версия, или укажи VOCAB_API_URL."
      );
    }
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
export const checkSources = (term) => request(`/api/lookup/${encodeURIComponent(term)}`);
export const setDefinition = (id, text) =>
  request(`/api/words/${id}/definition`, json("POST", { text }));
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
