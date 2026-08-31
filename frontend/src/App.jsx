import { useCallback, useEffect, useRef, useState } from "react";
import { addExample, addWord, deleteWord, dueWords, fromAcademy, listWords, reviewWord, updateWord, wordOfDay } from "./api.js";
import { canSpeak, speak, voicesFor } from "./speech.js";
import { clozeFor, matches } from "./recall.js";

const todayISO = () => new Date().toISOString().slice(0, 10);
const isDue = (word) => word.nextDue <= todayISO();
const dirOf = (lang) => (lang === "he" ? "rtl" : "ltr");
const LANGS = { he: "עברית", en: "English", ru: "Русский" };

const exampleList = (word) => (word.examples ? word.examples.split("\n").filter(Boolean) : []);

// Откуда объяснение — видно всегда. Академия даёт терминологическую справку,
// не толкование, поэтому подпись с названием словаря и годом обязательна.
function SourceNote({ word }) {
  if (!word.sourceLabel) return null;
  return (
    <p className="source" dir="rtl">
      {word.sourceUrl ? (
        <a href={word.sourceUrl} target="_blank" rel="noreferrer">{word.sourceLabel}</a>
      ) : (
        word.sourceLabel
      )}
    </p>
  );
}

function SpeakButton({ text, lang }) {
  if (!canSpeak()) return null;
  return (
    <button className="speak" onClick={() => speak(text, lang, savedVoice(lang))} aria-label="Прочитать вслух">
      🔊
    </button>
  );
}

// Голос — разовая настройка, живёт в браузере и на сервер не ходит.
function savedVoice(lang) {
  try {
    return localStorage.getItem(`voice:${lang}`) ?? "";
  } catch {
    return "";
  }
}

function VoicePicker({ lang }) {
  const [voices, setVoices] = useState([]);
  const [chosen, setChosen] = useState(savedVoice(lang));

  useEffect(() => {
    // Список голосов приезжает не сразу — перечитываем, когда он появится.
    const update = () => setVoices(voicesFor(lang));
    update();
    if (canSpeak()) {
      window.speechSynthesis.addEventListener("voiceschanged", update);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", update);
    }
  }, [lang]);

  // Голос один — выбирать не из чего, но его можно улучшить: системный
  // компактный звучит механически, улучшенный ставится отдельно.
  if (voices.length < 2) {
    return canSpeak() ? (
      <p className="muted voice-picker">
        Голос звучит механически? Скачай улучшенный: <strong>Системные настройки →
        Универсальный доступ → Устный контент → Системный голос → Управление голосами</strong>,
        найди иврит и возьми вариант Enhanced или Premium. На iPhone —
        Настройки → Универсальный доступ → Устный контент → Голоса.
      </p>
    ) : null;
  }

  function pick(name) {
    setChosen(name);
    try {
      localStorage.setItem(`voice:${lang}`, name);
    } catch {
      // Приватный режим — просто не запомнится, озвучка работает.
    }
    speak("שלום", lang, name);
  }

  return (
    <p className="voice-picker">
      <label className="field-label" htmlFor="voice">Голос озвучки</label>
      <select id="voice" value={chosen} onChange={(e) => pick(e.target.value)}>
        <option value="">по умолчанию</option>
        {voices.map((voice) => (
          <option key={voice.name} value={voice.name}>{voice.name}</option>
        ))}
      </select>
    </p>
  );
}

function Help({ lang }) {
  return (
    <div className="help">
      <p><strong>Как этим пользоваться</strong></p>
      <ol>
        <li><strong>На занятии</strong> — вкладка «Добавить»: вбей слово и жми Enter. Перевод и объяснение можно не заполнять, это делается потом.</li>
        <li><strong>Дома</strong> — вкладка «Слова»: нажми на слово, чтобы поправить опечатку, или возьми справку из Академии языка иврит одной кнопкой.</li>
        <li><strong>Каждый день</strong> — вкладка «Слово дня»: одно слово, с которым живёшь весь день. Придумал фразу — записал. Фразы потом всплывают на повторении.</li>
        <li><strong>Повторение</strong> — «Повторять»: не больше 10 слов за раз. Сначала вспомни сам, потом открывай. Нет сил — есть кнопка на три слова.</li>
      </ol>
      <p className="muted">Языки разделены сами: иврит, английский и русский живут отдельными списками, переключатель наверху появляется, когда есть что переключать. Английское слово можно спросить у Академии — она двуязычная и вернёт официальный ивритский эквивалент.</p>
      <p className="muted">Слово возвращается через 0, 1, 3, 7 и 16 дней — первый раз в тот же день, потому что забывается быстрее всего в первые сутки.</p>
      <VoicePicker lang={lang} />
    </div>
  );
}

// ---------- слово дня ----------

// Одно слово на день, с которым живёшь: прикладываешь его к своим ситуациям,
// пока оно не побывает в десятке разных контекстов.
function DayScreen({ lang, onChanged }) {
  const [word, setWord] = useState(undefined);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setWord(await wordOfDay(lang));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [lang]);

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
      <p className="day-term" dir={dirOf(word.lang)}>
        {word.term} <SpeakButton text={word.term} lang={word.lang} />
      </p>
      <p className="muted">Прочитай вслух — так запоминается лучше</p>

      {word.definition && <p className="definition" dir="rtl">{word.definition}</p>}
      <SourceNote word={word} />

      <form onSubmit={submit}>
        <label className="field-label" htmlFor="example">Твоя фраза с этим словом</label>
        <textarea
          id="example"
          dir={dirOf(word.lang)}
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

// Строгий режим: сначала пишешь ответ, потом видишь правильный. Узнавание
// ощущается как знание, поэтому «показал и решил, что знал» — не проверка.
function StrictCard({ word, cloze, onAnswer, onRequeue }) {
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (result !== "ok") return undefined;
    // Короткая пауза, чтобы «верно» успело попасться на глаза.
    const timer = setTimeout(() => onAnswer(true), 800);
    return () => clearTimeout(timer);
  }, [result]);

  function check(event) {
    event.preventDefault();
    setResult(matches(typed, cloze.answer) ? "ok" : "miss");
  }

  return (
    <div className="strict">
      <p className="cloze" dir={dirOf(word.lang)}>{cloze.prompt}</p>

      {result === null && (
        <form onSubmit={check}>
          <input
            className="term-input"
            dir={dirOf(word.lang)}
            autoFocus
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <button className="primary" type="submit">Проверить</button>
          <button className="quiet" type="button" onClick={() => setResult("gaveup")}>
            Не помню
          </button>
        </form>
      )}

      {result === "ok" && (
        <div className="verdict">
          <p className="ok">Верно ✓</p>
          <p className="review-term" dir={dirOf(word.lang)}>
            {cloze.answer} <SpeakButton text={word.term} lang={word.lang} />
          </p>
        </div>
      )}

      {result !== null && result !== "ok" && (
        <div className="verdict">
          {result === "miss" && (
            <>
              {/* Подпись и сам ответ — разные направления письма: одной строкой
                  двоеточие уезжает в конец и читается как мусор. */}
              <p className="muted">Ты написала:</p>
              <p className="typed" dir={dirOf(word.lang)}>{typed}</p>
            </>
          )}
          <p className="review-term" dir={dirOf(word.lang)}>
            {cloze.answer} <SpeakButton text={word.term} lang={word.lang} />
          </p>

          {result === "gaveup" ? (
            <button className="primary" onClick={() => onAnswer(false)}>Дальше</button>
          ) : (
            <div className="verdict-actions">
              {/* Отделяем незнание от промаха чтения — иначе дислексия
                  превращает каждую описку в «не знаю». */}
              {/* «Не знала» стоит первой намеренно: зелёная кнопка сверху
                  подталкивала бы засчитывать себе знание не глядя. */}
              <button className="answer-no" onClick={() => onAnswer(false)}>Не знала</button>
              <button className="answer-yes" onClick={() => onAnswer(true)}>Опечатка — я знала</button>
              <button className="quiet" onClick={onRequeue}>Показать ещё раз</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RevealCard({ word, onAnswer }) {
  const [revealed, setRevealed] = useState(0);

  return (
    <>
      <p className="review-term" dir={dirOf(word.lang)}>
        {word.term} <SpeakButton text={word.term} lang={word.lang} />
      </p>
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
          <SourceNote word={word} />
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
          <button className="answer-no" onClick={() => onAnswer(false)}>Не знаю</button>
          <button className="answer-yes" onClick={() => onAnswer(true)}>Знаю ✓</button>
        </div>
      )}
    </>
  );
}

function ReviewScreen({ queue, onFinished }) {
  const [cards, setCards] = useState(queue);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState(null);
  const word = cards[index];

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
      setIndex(index + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  // «Показать ещё раз» — в конец очереди, без обращения к серверу: коробку
  // меняет только настоящий ответ.
  function requeue() {
    setCards([...cards.slice(0, index), ...cards.slice(index + 1), word]);
  }

  // Строгий режим работает там, где есть своя фраза с этим словом.
  // Нет фразы — сверять не с чем, остаётся раскрытие.
  const cloze = clozeFor(word);

  return (
    <div className="review">
      <p className="review-head">
        <span className="muted">{index + 1} из {cards.length}</span>
        <button className="exit" onClick={onFinished}>Выйти</button>
      </p>

      {cloze ? (
        <StrictCard
          key={word.id}
          word={word}
          cloze={cloze}
          onAnswer={answer}
          onRequeue={requeue}
        />
      ) : (
        <RevealCard key={word.id} word={word} onAnswer={answer} />
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}

// ---------- список слов: правка, справка, удаление ----------

function WordRow({ word, open, onToggle, onChanged }) {
  const [draft, setDraft] = useState(word);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [choices, setChoices] = useState([]);

  // Слово могло измениться на сервере — например, справка пришла из Академии.
  // Без этого в полях остаётся старый черновик и следующее «Сохранить»
  // затирает только что полученное.
  useEffect(() => { setDraft(word); }, [word.id, word.updatedAt]);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      // Точного совпадения в Академии нет — выбирает человек.
      setChoices(result?.candidates ?? []);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="word-row" onClick={onToggle}>
        <span className="word-row-term" dir={dirOf(word.lang)}>{word.term}</span>
        <span className="muted">
          {word.definition ? `коробка ${word.box}` : "без объяснения"}
        </span>
      </button>
    );
  }

  return (
    <div className="word-card">
      <label className="field-label">Слово</label>
      <input
        dir="rtl"
        value={draft.term}
        onChange={(e) => setDraft({ ...draft, term: e.target.value })}
      />

      <label className="field-label">Объяснение</label>
      <textarea
        dir="rtl"
        rows={3}
        value={draft.definition}
        onChange={(e) => setDraft({ ...draft, definition: e.target.value })}
      />
      <SourceNote word={word} />

      <label className="field-label">Перевод</label>
      <input
        dir="ltr"
        value={draft.translation}
        onChange={(e) => setDraft({ ...draft, translation: e.target.value })}
      />

      <div className="row-actions">
        <button
          className="secondary"
          disabled={busy}
          onClick={() => run(() => fromAcademy(word.id))}
        >
          Из Академии
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            run(() =>
              updateWord(word.id, {
                term: draft.term,
                definition: draft.definition,
                translation: draft.translation,
              })
            )
          }
        >
          Сохранить
        </button>
        {confirming ? (
          <button className="danger" disabled={busy} onClick={() => run(() => deleteWord(word.id))}>
            Точно удалить
          </button>
        ) : (
          <button className="secondary" onClick={() => setConfirming(true)}>Удалить</button>
        )}
      </div>

      {choices.length > 0 && (
        <div className="choices">
          <p className="muted">Точного совпадения нет. Что из этого?</p>
          {choices.map((choice) => (
            <button
              key={choice.href}
              className="secondary"
              dir="rtl"
              disabled={busy}
              onClick={() => run(() => fromAcademy(word.id, choice.href))}
            >
              {choice.display}
            </button>
          ))}
          <button className="quiet" onClick={() => setChoices([])}>Ничего не подходит</button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <button className="quiet" onClick={onToggle}>Свернуть</button>
    </div>
  );
}

function WordsScreen({ words, onChanged }) {
  const [openId, setOpenId] = useState(null);

  if (words.length === 0) {
    return <p className="muted">Слов пока нет. Начни с вкладки «Добавить».</p>;
  }

  // Сначала то, у чего нет объяснения: это и есть список дел.
  const sorted = [...words].sort((a, b) => {
    const byDefinition = Number(Boolean(a.definition)) - Number(Boolean(b.definition));
    return byDefinition !== 0 ? byDefinition : b.id - a.id;
  });

  return (
    <div>
      {sorted.map((word) => (
        <WordRow
          key={word.id}
          word={word}
          open={openId === word.id}
          onToggle={() => setOpenId(openId === word.id ? null : word.id)}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

// ---------- оболочка ----------

export default function App() {
  const [words, setWords] = useState([]);
  const [db, setDb] = useState("");
  const [view, setView] = useState("add");
  const [showHelp, setShowHelp] = useState(false);
  const [lang, setLang] = useState("he");
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

  // Списки языков раздельные: иврит учится отдельно от английского.
  const mine = words.filter((word) => word.lang === lang);
  const counts = words.reduce((acc, word) => ({ ...acc, [word.lang]: (acc[word.lang] ?? 0) + 1 }), {});
  const otherLangs = Object.keys(LANGS).filter((code) => code !== lang && counts[code]);

  const dueCount = mine.filter(isDue).length;
  const pending = mine.filter((word) => !word.definition).length;
  const learned = mine.filter((word) => word.box === 5).length;
  const phrases = mine.reduce((sum, word) => sum + exampleList(word).length, 0);

  async function startReview(limit) {
    try {
      setQueue(await dueWords(limit, lang));
      setView("review");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main>
      <h1>Слова с занятий</h1>

      <button className="quiet help-toggle" onClick={() => setShowHelp(!showHelp)}>
        {showHelp ? "Свернуть инструкцию" : "Как этим пользоваться"}
      </button>

      {otherLangs.length > 0 && (
        <nav className="langs">
          {Object.keys(LANGS)
            .filter((code) => counts[code])
            .map((code) => (
              <button
                key={code}
                className={code === lang ? "lang active" : "lang"}
                onClick={() => { setLang(code); setView("add"); }}
              >
                {LANGS[code]} ({counts[code]})
              </button>
            ))}
        </nav>
      )}

      <p className="counters">
        К повторению: <strong>{dueCount}</strong> · выучено: <strong>{learned}</strong> · своих фраз: <strong>{phrases}</strong>
        {pending > 0 && <> · без объяснения: <strong>{pending}</strong></>}
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
          <button className={view === "words" ? "tab active" : "tab"} onClick={() => setView("words")}>
            Слова ({mine.length})
          </button>
        </nav>
      )}

      {view !== "review" && dueCount > 3 && (
        <button className="quiet" onClick={() => startReview(3)}>
          Нет сил — только 3 слова
        </button>
      )}

      {error && <p className="error">{error}</p>}

      {(showHelp || words.length === 0) && <Help lang={lang} />}

      {view === "day" && <DayScreen lang={lang} onChanged={reload} />}
      {view === "add" && <AddScreen onAdded={reload} />}
      {view === "words" && <WordsScreen words={mine} onChanged={reload} />}
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
