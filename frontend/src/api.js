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
export const dueWords = (limit, lang) => request(`/api/words/due?limit=${limit}&lang=${lang}`);
export const addWord = (word) => request("/api/words", json("POST", word));
export const updateWord = (id, patch) => request(`/api/words/${id}`, json("PATCH", patch));
export const reviewWord = (id, known) =>
  request(`/api/words/${id}/review`, json("PATCH", { known }));
export const saveImage = (id, url) =>
  request(`/api/words/${id}/image`, json("POST", { url }));
export const drawImage = (id) =>
  request(`/api/words/${id}/image/generate`, { method: "POST" });
export const wordFamily = (id) => request(`/api/words/${id}/family`);
export const fromPealim = (id) =>
  request(`/api/words/${id}/pealim`, json("POST", { overwrite: true }));
export const wordOfDay = (lang) => request(`/api/word-of-day?lang=${lang}`);
export const deleteWord = (id) => request(`/api/words/${id}`, { method: "DELETE" });
// overwrite: это нажимает человек в приложении и видит, что заменяет.
// У агента такого флага нет — ему перезапись запрещена.
export const addExample = (id, text) =>
  request(`/api/words/${id}/examples`, json("POST", { text }));
export const previewImport = (text) => request("/api/import/preview", json("POST", { text }));
export const currentLesson = () => request("/api/lessons/current");
export const startLesson = () => request("/api/lessons", json("POST", {}));
export const finishLesson = (id) => request(`/api/lessons/${id}/finish`, json("PATCH", {}));
