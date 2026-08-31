import { useCallback, useEffect, useRef, useState } from "react";
import { addExample, addWord, dueWords, listWords, reviewWord, updateWord, wordOfDay } from "./api.js";
import { canSpeak, speak } from "./speech.js";

const todayISO = () => new Date().toISOString().slice(0, 10);
const isDue = (word) => word.nextDue <= todayISO();
const exampleList = (word) => (word.examples ? word.examples.split("\n").filter(Boolean) : []);

function SpeakButton({ text }) {
  if (!canSpeak()) return null;
  return (
    <button className="speak" onClick={() => speak(text)} aria-label="Прочитать вслух">
      🔊
    </button>
  );
}

// ---------- слово дня ----------

// Одно слово на день, с которым живёшь: прикладываешь его к своим ситуациям,
// пока оно не побывает в десятке разных контекстов.
function DayScreen({ onChanged }) {
  const [word, setWord] = useState(undefined);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setWord(await wordOfDay());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (word === undefined) return <p className="muted">Загружаю…</p>;
  if (word === null) {
    return <p className="muted">Пока нет слов из первых коробок. Добавь слово — оно и станет словом дня.</p>;
  }

  async function submit(event) {
    event.preventDefault();
    setError(null);
    try {
      setWord(await addExample(word.id, draft));
      setDraft("");
      onChanged();
    } catch (err) {
      // Фразу не стираем: её придумывали.
      setError(err.message);
    }
  }

  const examples = exampleList(word);

  return (
    <div className="day">
      <p className="field-label">Слово дня</p>
      <p className="day-term" dir="rtl">
        {word.term} <SpeakButton text={word.term} />
      </p>
      <p className="muted">Прочитай вслух — так запоминается лучше</p>

      {word.definition && <p className="definition" dir="rtl">{word.definition}</p>}

      <form onSubmit={submit}>
        <label className="field-label" htmlFor="example">Твоя фраза с этим словом</label>
        <textarea
          id="example"
          dir="rtl"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="primary" type="submit">Добавить фразу</button>
      </form>

      {error && <p className="error">{error}</p>}

      {examples.length > 0 && (
        <ul className="examples">
          {examples.map((line, i) => <li key={i} dir="rtl">{line}</li>)}
        </ul>
      )}
    </div>
  );
}

// ---------- добавить слово ----------

function AddScreen({ onAdded }) {
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [translation, setTranslation] = useState("");
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const termInput = useRef(null);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const word = await addWord({ term, definition, translation });
      // Успех — и только успех — очищает поля.
      setTerm("");
      setDefinition("");
      setTranslation("");
      setStatus({ kind: "ok", text: `«${word.term}» записано` });
      onAdded();
    } catch (error) {
      // Поле НЕ очищаем: слово не должно пропасть из-за сети.
      setStatus({ kind: "error", text: error.message });
    } finally {
      setSaving(false);
      termInput.current?.focus();
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="field-label" htmlFor="term">Новое слово</label>
      <input
        id="term"
        ref={termInput}
        className="term-input"
        dir="rtl"
        autoFocus
        autoComplete="off"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="מילה"
      />

      <details className="extra">
        <summary>Добавить объяснение сразу</summary>
        <label className="field-label" htmlFor="definition">Объяснение на иврите</label>
        <textarea
          id="definition"
          dir="rtl"
          rows={3}
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
        />
        <label className="field-label" htmlFor="translation">Перевод (необязательно)</label>
        <input
          id="translation"
          dir="ltr"
          autoComplete="off"
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
        />
      </details>

      <button className="primary" type="submit" disabled={saving}>
        {saving ? "Сохраняю…" : "Сохранить"}
      </button>

      {status && <p className={status.kind === "error" ? "error" : "ok"}>{status.text}</p>}
    </form>
  );
}

// ---------- повторение ----------

function ReviewScreen({ queue, onFinished }) {
  // Выход есть всегда: застрять в очереди нельзя.
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [error, setError] = useState(null);
  const word = queue[index];

  if (!word) {
    return (
      <div className="done">
        <p className="done-title">На сегодня хватит</p>
        <p className="muted">Повторено слов: {queue.length}</p>
        <button className="primary" onClick={onFinished}>Вернуться</button>
      </div>
    );
  }

  async function answer(known) {
    setError(null);
    try {
      await reviewWord(word.id, known);
      setRevealed(0);
      setIndex(index + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="review">
      <p className="review-head">
        <span className="muted">{index + 1} из {queue.length}</span>
        <button className="exit" onClick={onFinished}>Выйти</button>
      </p>
      <p className="review-term" dir="rtl">{word.term} <SpeakButton text={word.term} /></p>
      <p className="muted">Прочитай вслух, потом вспоминай</p>

      {revealed === 0 && (
        <button className="primary" onClick={() => setRevealed(1)}>Показать объяснение</button>
      )}

      {revealed >= 1 && (
        <div className="reveal">
          {word.definition ? (
            <p className="definition" dir="rtl">{word.definition}</p>
          ) : (
            <p className="muted">Объяснения пока нет</p>
          )}
          {word.definitionSource === "generated" && (
            <p className="muted">⚠️ сгенерировано, проверь</p>
          )}
          {exampleList(word).length > 0 && (
            <ul className="examples">
              {exampleList(word).map((line, i) => <li key={i} dir="rtl">{line}</li>)}
            </ul>
          )}
        </div>
      )}

      {revealed === 1 && word.translation && (
        <button className="secondary" onClick={() => setRevealed(2)}>Не понял — перевод</button>
      )}

      {revealed === 2 && <p className="translation" dir="ltr">{word.translation}</p>}

      {revealed >= 1 && (
        <div className="answers">
          <button className="answer-no" onClick={() => answer(false)}>Не знаю</button>
          <button className="answer-yes" onClick={() => answer(true)}>Знаю ✓</button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}

// ---------- дозаполнить объяснения ----------

function FillScreen({ words, onSaved }) {
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState(null);

  if (words.length === 0) {
    return <p className="muted">Все слова с объяснением. Ничего разбирать не надо.</p>;
  }

  async function save(word) {
    setError(null);
    try {
      await updateWord(word.id, { definition: drafts[word.id] ?? "" });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      {words.map((word) => (
        <div className="fill-row" key={word.id}>
          <p className="fill-term" dir="rtl">{word.term}</p>
          <textarea
            dir="rtl"
            rows={2}
            value={drafts[word.id] ?? ""}
            onChange={(e) => setDrafts({ ...drafts, [word.id]: e.target.value })}
          />
          <button className="secondary" onClick={() => save(word)}>Сохранить</button>
        </div>
      ))}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

// ---------- оболочка ----------

export default function App() {
  const [words, setWords] = useState([]);
  const [db, setDb] = useState("");
  const [view, setView] = useState("add");
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      setWords(await listWords());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Видно, на какой базе крутится: локально sqlite, на Render postgres.
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setDb(data.db))
      .catch(() => setDb(""));
  }, []);

  const dueCount = words.filter(isDue).length;
  const pending = words.filter((word) => !word.definition);
  const learned = words.filter((word) => word.box === 5).length;
  const phrases = words.reduce((sum, word) => sum + exampleList(word).length, 0);

  async function startReview(limit) {
    try {
      setQueue(await dueWords(limit));
      setView("review");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main>
      <h1>Слова с занятий</h1>

      <p className="counters">
        К повторению: <strong>{dueCount}</strong> · выучено: <strong>{learned}</strong> · своих фраз: <strong>{phrases}</strong>
      </p>

      {view !== "review" && (
        <nav className="nav">
          <button className={view === "day" ? "tab active" : "tab"} onClick={() => setView("day")}>
            Слово дня
          </button>
          <button className={view === "add" ? "tab active" : "tab"} onClick={() => setView("add")}>
            Добавить
          </button>
          <button className="tab" onClick={() => startReview(10)} disabled={dueCount === 0}>
            Повторять
          </button>
          <button className={view === "fill" ? "tab active" : "tab"} onClick={() => setView("fill")}>
            Разобрать ({pending.length})
          </button>
        </nav>
      )}

      {view !== "review" && dueCount > 3 && (
        <button className="quiet" onClick={() => startReview(3)}>
          Нет сил — только 3 слова
        </button>
      )}

      {error && <p className="error">{error}</p>}

      {view === "day" && <DayScreen onChanged={reload} />}
      {view === "add" && <AddScreen onAdded={reload} />}
      {view === "fill" && <FillScreen words={pending} onSaved={reload} />}
      {view === "review" && (
        <ReviewScreen
          queue={queue}
          onFinished={() => { setView("add"); reload(); }}
        />
      )}

      {db && <p className="footer">Database: {db}</p>}
    </main>
  );
}
