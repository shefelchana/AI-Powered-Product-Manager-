// One place that knows how to talk to the backend, so screens deal with data
// and never with response codes.
async function request(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error("Нет связи с сервером — ничего не потеряно, попробуй ещё раз");
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Пустой ответ — это нормально, ошибку определяем по коду.
  }

  if (!res.ok) {
    const error = new Error(data?.error || `Сервер ответил ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

const json = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const listWords = () => request("/api/words");
export const dueWords = (limit) => request(`/api/words/due?limit=${limit}`);
export const addWord = (word) => request("/api/words", json("POST", word));
export const updateWord = (id, patch) => request(`/api/words/${id}`, json("PATCH", patch));
export const reviewWord = (id, known) =>
  request(`/api/words/${id}/review`, json("PATCH", { known }));
export const wordOfDay = () => request("/api/word-of-day");
export const deleteWord = (id) => request(`/api/words/${id}`, { method: "DELETE" });
export const fromAcademy = (id) => request(`/api/words/${id}/academy`, { method: "POST" });
export const addExample = (id, text) =>
  request(`/api/words/${id}/examples`, json("POST", { text }));
