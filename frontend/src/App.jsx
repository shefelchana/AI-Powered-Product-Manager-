import { useCallback, useEffect, useRef, useState } from "react";
import { addExample, addWord, applyLesson, currentLesson, deleteWord, drawImage, dueWords, finishLesson, fromPealim, listLessons, startLesson, listWords, practiceSet, preparePractice, previewImport, previewLesson, recordAttempt, reviewWord, saveImage, updateWord, wordFamily, wordOfDay } from "./api.js";
import { canSpeak, speak, voicesFor } from "./speech.js";
import { matches, promptFor } from "./recall.js";
import { lessonSummary, formatDate } from "./prep.js";

const todayISO = () => new Date().toISOString().slice(0, 10);
const isDue = (word) => word.nextDue <= todayISO();
const dirOf = (lang) => (lang === "he" ? "rtl" : "ltr");
const LANGS = { he: "עברית", en: "English", ru: "Русский" };

const exampleList = (word) => (word.examples ? word.examples.split("\n").filter(Boolean) : []);

// Откуда объяснение — видно всегда. Академия даёт терминологическую справку,
// не толкование, поэтому подпись с названием словаря и годом обязательна.
function SourceNote({ word }) {
  // Объяснение, написанное агентом, обязано быть отличимо от вписанного руками.
  // Это единственная гарантия, ради которой запись агента вообще разрешена:
  // такие карточки Анна потом проверяет, а непомеченные — нет.
  if (word.definitionSource === "generated") {
    return <p className="source generated">⚠️ сгенерировано, проверь</p>;
  }
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

// Картинка идёт первой, до текста: образ цепляется лучше слова.
// Адрес внешний и может протухнуть — тогда просто ничего не показываем.
function WordImage({ word }) {
  const [broken, setBroken] = useState(false);
  // Картинка лежит у приложения, поэтому адрес не протухает. updatedAt в ссылке —
  // чтобы после замены картинки браузер показал новую, а не старую из кэша.
  useEffect(() => { setBroken(false); }, [word.updatedAt]);
  if (!word.hasImage || broken) return null;
  return (
    <img
      className="word-image"
      src={`/api/words/${word.id}/image?v=${encodeURIComponent(word.updatedAt ?? "")}`}
      alt={word.term}
      onError={() => setBroken(true)}
    />
  );
}

// Корень и биньян — одной строкой, без грамматического разбора. Задача строки
// не научить узору, а дать зацепку: слово из знакомой семьи запоминается легче.
function RootLine({ word }) {
  if (!word.root) return null;
  // Строка идёт по направлению языка слова, иначе корень оказывается прижат
  // к другому краю, чем весь остальной ивритский текст карточки.
  return (
    <p className="root-line" dir={dirOf(word.lang)}>
      {word.root}
      {word.binyan ? ` · ${word.binyan}` : ""}
    </p>
  );
}

// Слова того же корня. Появляется само, когда их набирается хотя бы два —
// отдельного действия не требует.
function Family({ word }) {
  const [family, setFamily] = useState([]);

  useEffect(() => {
    if (!word.root) return;
    let active = true;
    wordFamily(word.id)
      .then((list) => active && setFamily(list))
      .catch(() => active && setFamily([]));
    return () => { active = false; };
  }, [word.id, word.root]);

  if (family.length === 0) return null;
  return (
    <div className="family">
      <p className="muted">От этого корня у тебя уже есть:</p>
      <ul>
        {family.map((relative) => (
          <li key={relative.id}>
            <span dir={dirOf(relative.lang)}>{relative.term}</span>
            {relative.binyan ? ` (${relative.binyan})` : ""}
            {relative.definition ? ` — ${relative.definition}` : ""}
          </li>
        ))}
      </ul>
    </div>
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
        <li><strong>Дома</strong> — вкладка «Слова»: нажми на слово, чтобы поправить опечатку, или возьми значение, корень и биньян из Pealim одной кнопкой.</li>
        <li><strong>Каждый день</strong> — вкладка «Слово дня»: одно слово, с которым живёшь весь день. Придумал фразу — записал. Фразы потом всплывают на повторении.</li>
        <li><strong>Повторение</strong> — «Повторять»: не больше 10 слов за раз. Сначала вспомни сам, потом открывай. Нет сил — есть кнопка на три слова.</li>
      </ol>
      <p className="muted">К слову можно добавить <strong>картинку</strong> — свой яркий образ, а не первую попавшуюся: слово с образом цепляется заметно лучше. А «Повторять на слух» прячет написание и сначала произносит слово — так ухо привыкает к звукам языка.</p>
      <p className="muted">Языки разделены сами: иврит, английский и русский живут отдельными списками, переключатель наверху появляется, когда есть что переключать.</p>
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
      <WordImage word={word} />
      <p className="day-term" dir={dirOf(word.lang)}>
        {word.term} <SpeakButton text={word.term} lang={word.lang} />
      </p>
      <p className="muted">Прочитай вслух — так запоминается лучше</p>

      {word.definition && <p className="definition" dir="rtl">{word.definition}</p>}
      <SourceNote word={word} />
      <RootLine word={word} />
      <Family word={word} />

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

// Шапка урока: одна кнопка «Начать урок», пока он идёт — «Закончить».
// Всё, что добавлено между ними, сервер привязывает к этому уроку.
function LessonBar() {
  const [lesson, setLesson] = useState(undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    currentLesson().then(setLesson).catch((e) => { setLesson(null); setError(e.message); });
  }, []);

  async function toggle() {
    setError(null);
    try {
      setLesson(lesson ? null : await startLesson());
      if (lesson) await finishLesson(lesson.id);
    } catch (e) {
      setError(e.message);
    }
  }

  if (lesson === undefined) return null;
  return (
    <div className="lesson-bar">
      {lesson ? (
        <>
          <span>Урок {formatLessonDate(lesson.date)} · идёт</span>
          <button className="quiet" type="button" onClick={toggle}>Закончить урок</button>
        </>
      ) : (
        <button className="quiet" type="button" onClick={toggle}>Начать урок</button>
      )}
      {error && <span className="error">{error}</span>}
    </div>
  );
}

function formatLessonDate(iso) {
  const [y, m, d] = String(iso ?? "").split("-");
  return d && m ? `${d}.${m}` : iso;
}

function AddScreen({ onAdded }) {
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [translation, setTranslation] = useState("");
  const [question, setQuestion] = useState(false);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const termInput = useRef(null);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const word = await addWord({ term, definition, translation, question });
      // Успех — и только успех — очищает поля.
      setTerm("");
      setDefinition("");
      setTranslation("");
      setQuestion(false);
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
    <>
    <LessonBar />
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

      {/* «?» — не поняла, спросить на следующем уроке. Одна галочка, не поле. */}
      <label className="check">
        <input type="checkbox" checked={question} onChange={(e) => setQuestion(e.target.checked)} />
        {" "}не поняла — спросить
      </label>

      <button className="primary" type="submit" disabled={saving}>
        {saving ? "Сохраняю…" : "Сохранить"}
      </button>

      {status && <p className={status.kind === "error" ? "error" : "ok"}>{status.text}</p>}
    </form>

    <ImportBlock onAdded={onAdded} />
    <LessonImportBlock onAdded={onAdded} />
    </>
  );
}

// ---------- импорт из текста урока ----------

// Текст вставляется как есть — с переводами и пометками: вылавливать ивритские
// слова руками по одному скучно, это работа машины. А вот что из выловленного
// станет карточками — решает человек: в тексте урока полно слов, которые и так
// давно знакомы.
function ImportBlock({ onAdded }) {
  const [text, setText] = useState("");
  const [candidates, setCandidates] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  async function find() {
    setBusy(true);
    setStatus(null);
    try {
      const { candidates: found } = await previewImport(text);
      setCandidates(found);
      // Новые слова отмечены сразу, имеющиеся — нет: их добавлять некуда.
      setPicked(new Set(found.filter((c) => !c.exists).map((c) => c.term)));
      if (found.length === 0) setStatus({ kind: "error", text: "Ивритских слов в тексте не нашлось" });
    } catch (error) {
      setStatus({ kind: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  function toggle(term) {
    const next = new Set(picked);
    if (next.has(term)) next.delete(term);
    else next.add(term);
    setPicked(next);
  }

  async function addPicked() {
    setBusy(true);
    setStatus(null);
    const failed = [];
    let added = 0;
    // По одному, а не разом: упавшее слово не должно утянуть за собой остальные.
    for (const term of picked) {
      try {
        await addWord({ term });
        added += 1;
      } catch {
        failed.push(term);
      }
    }
    setBusy(false);
    if (failed.length > 0) {
      setStatus({ kind: "error", text: `Записано: ${added}. Не получилось: ${failed.join(", ")}` });
      setPicked(new Set(failed));
    } else {
      setStatus({ kind: "ok", text: `Записано слов: ${added}` });
      setText("");
      setCandidates(null);
      setPicked(new Set());
    }
    if (added > 0) onAdded();
  }

  return (
    <details className="extra">
      <summary>Импорт из текста урока</summary>
      <label className="field-label" htmlFor="import-text">Вставь текст — слова найдутся сами</label>
      <textarea
        id="import-text"
        dir="auto"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="quiet" type="button" onClick={find} disabled={busy || !text.trim()}>
        {busy && candidates === null ? "Ищу…" : "Найти слова"}
      </button>

      {candidates?.length > 0 && (
        <>
          <ul className="import-list">
            {candidates.map(({ term, exists }) => (
              <li key={term}>
                <label className={exists ? "muted" : ""}>
                  <input
                    type="checkbox"
                    disabled={exists || busy}
                    checked={picked.has(term)}
                    onChange={() => toggle(term)}
                  />
                  <span dir="rtl">{term}</span>
                  {exists && <span className="muted"> — уже в колоде</span>}
                </label>
              </li>
            ))}
          </ul>
          <button className="primary" type="button" onClick={addPicked} disabled={busy || picked.size === 0}>
            {busy ? "Записываю…" : `Добавить выбранные (${picked.size})`}
          </button>
        </>
      )}

      {status && <p className={status.kind === "error" ? "error" : "ok"}>{status.text}</p>}
    </details>
  );
}

// ---------- импорт разбора урока ----------

// Разбор урока приходит JSON-файлом из конвейера расшифровки (или конспектом
// преподавателя, прогнанным через тот же промпт). Здесь — тройки
// «слово · значение · фраза» с галочками. Сервер ничего не пишет, пока не
// нажата «Записать»: что попадёт в колоду, решает человек.
function LessonImportBlock({ onAdded }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  async function find() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await previewLesson(text);
      setPreview(result);
      // Отмечено то, что даст новое: новые слова и фразы к знакомым.
      setPicked(new Set(result.candidates.filter((c) => !c.exists || (c.example && !c.hasExample)).map((c) => c.term)));
      if (result.candidates.length === 0 && (result.sentences ?? []).length === 0) setStatus({ kind: "error", text: "В разборе не нашлось ни слов, ни предложений" });
    } catch (error) {
      setStatus({ kind: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  function toggle(term) {
    const next = new Set(picked);
    if (next.has(term)) next.delete(term);
    else next.add(term);
    setPicked(next);
  }

  async function write() {
    setBusy(true);
    setStatus(null);
    try {
      const picks = preview.candidates.filter((c) => picked.has(c.term));
      const result = await applyLesson(preview.lesson, picks, preview.sentences ?? []);
      setStatus({ kind: "ok", text: `Урок ${formatLessonDate(preview.lesson.date)}: новых слов ${result.added}, дополнено ${result.updated}, предложений ${result.sentences ?? 0}` });
      setText("");
      setPreview(null);
      setPicked(new Set());
      onAdded();
    } catch (error) {
      setStatus({ kind: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  const kindLabel = { word: "", correction: "исправление", phrase: "фраза" };

  return (
    <details className="extra">
      <summary>Импорт из разбора урока</summary>
      <label className="field-label" htmlFor="lesson-json">Вставь JSON разбора урока</label>
      <textarea
        id="lesson-json"
        dir="ltr"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{"lesson": {...}, "items": [...]}'
      />
      <button className="quiet" type="button" onClick={find} disabled={busy || !text.trim()}>
        {busy && preview === null ? "Разбираю…" : "Показать кандидатов"}
      </button>

      {preview && (preview.candidates.length > 0 || (preview.sentences ?? []).length > 0) && (
        <>
          <p className="muted">Урок {formatLessonDate(preview.lesson.date)}{preview.lesson.title ? ` · ${preview.lesson.title}` : ""} · слов: {preview.candidates.length} · предложений для практики: {(preview.sentences ?? []).length}</p>
          <ul className="import-list lesson-import">
            {preview.candidates.map((c) => (
              <li key={c.term}>
                <label>
                  <input type="checkbox" disabled={busy} checked={picked.has(c.term)} onChange={() => toggle(c.term)} />
                  <span className="cand-term" dir="rtl">{c.term}</span>
                  {c.exists && <span className="muted"> · уже в колоде{c.hasDefinition ? "" : ", без значения"}</span>}
                  {kindLabel[c.kind] && <span className="muted"> · {kindLabel[c.kind]}</span>}
                </label>
                {c.meaning && <div className="cand-meaning">{c.meaning}</div>}
                {c.example && <div className="cand-example" dir="rtl">{c.example}{c.hasExample ? " (уже есть)" : ""}</div>}
              </li>
            ))}
          </ul>
          <button className="primary" type="button" onClick={write} disabled={busy || (picked.size === 0 && (preview.sentences ?? []).length === 0)}>
            {busy ? "Записываю…" : `Записать (слов ${picked.size}, предложений ${(preview.sentences ?? []).length})`}
          </button>
        </>
      )}

      {status && <p className={status.kind === "error" ? "error" : "ok"}>{status.text}</p>}
    </details>
  );
}

// Аудио преподавателя с сайта ульпана: файл лежит в их хранилище, играем по адресу.
const SENTENCE_AUDIO = "https://hebreway-hadash.s3.eu-central-1.amazonaws.com/sentences-audio/";
function AudioButton({ file }) {
  const src = /^https?:/.test(file) ? file : SENTENCE_AUDIO + file;
  return (
    <button className="listen-again" type="button" onClick={() => new Audio(src).play().catch(() => {})} aria-label="Прослушать">
      🔊
    </button>
  );
}

// ---------- практика форм ----------

// Как на уроке «хором»: перевод и подпись формы — пишешь форму на иврите.
// Ответ известен точно (таблица Pealim или предлог с местоимением),
// проверка та же щадящая, что в строгом режиме. Расписание не трогается.
function PracticeScreen({ lang, onFinished }) {
  const [items, setItems] = useState(null);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState(null);
  const [note, setNote] = useState("Готовлю формы…");
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const prepared = await preparePractice(lang);
        if (prepared.fetched > 0) setNote(`Формы взяты из Pealim для ${prepared.fetched} глаголов`);
        const set = await practiceSet(10, lang);
        if (alive) { setItems(set); setNote(null); }
      } catch (e) {
        if (alive) { setError(e.message); setItems([]); }
      }
    })();
    return () => { alive = false; };
  }, [lang]);

  const ex = items?.[index];

  async function check(event) {
    event.preventDefault();
    const ok = matches(typed, ex.answer);
    setResult(ok ? "ok" : "miss");
    try { await recordAttempt(ex.wordId, ex.formId, ok, ex.sentenceId ?? null); } catch { /* журнал — не повод останавливать практику */ }
  }

  function next() {
    setTyped("");
    setResult(null);
    setIndex(index + 1);
  }

  if (items === null) return <div className="review"><p className="muted">{note}</p></div>;
  if (!ex) {
    return (
      <div className="done">
        <p className="done-title">{items.length === 0 ? "Пока нечего тренировать" : "Фразы отработаны"}</p>
        <p className="muted">{items.length === 0 ? "Нужны глаголы со значением (формы придут из Pealim) или словосочетания с предлогом" : `Сделано: ${items.length}`}</p>
        {error && <p className="error">{error}</p>}
        <button className="primary" onClick={onFinished}>Вернуться</button>
      </div>
    );
  }

  return (
    <div className="review strict">
      <p className="review-head">
        <span className="muted">{index + 1} из {items.length}</span>
        <button className="exit" onClick={onFinished}>Выйти</button>
      </p>
      {note && <p className="muted">{note}</p>}
      <p className="prompt-label muted">{{ form: "форма глагола", preposition: "предлог с местоимением", sentence: "предложение целиком" }[ex.kind]}</p>
      <p className="cloze" dir="ltr">{ex.prompt}</p>
      {ex.kind !== "sentence" && <p className="form-label" dir="ltr">{ex.label}</p>}

      {result === null && (
        <form onSubmit={check}>
          <input className="term-input" dir="rtl" autoFocus autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          <button className="primary" type="submit">Проверить</button>
          <button className="quiet" type="button" onClick={() => setResult("gaveup")}>Не помню</button>
        </form>
      )}

      {result !== null && (
        <div className="verdict">
          {result === "ok" && <p className="ok">Верно ✓</p>}
          {result === "miss" && (
            <>
              <p className="muted">Ты написала:</p>
              <p className="typed" dir="rtl">{typed}</p>
            </>
          )}
          <p className="review-term" dir="rtl">
            {ex.answerVocalized || ex.answer}{" "}
            {ex.audioUrl ? <AudioButton file={ex.audioUrl} /> : <SpeakButton text={ex.answer} lang="he" />}
          </p>
          {ex.kind !== "sentence" && <p className="muted">{ex.term} · {ex.label}</p>}
          <button className="primary" onClick={next}>Дальше</button>
        </div>
      )}
    </div>
  );
}

// ---------- к уроку ----------

// Накануне урока: слова прошлого урока целиком (не только просроченные),
// без записи в расписание, и список «?» — что спросить.
function PrepBlock({ words, lessons, onStart }) {
  const { lesson, words: lessonWords, questions } = lessonSummary(words, lessons);
  if (!lesson && questions.length === 0) return null;
  return (
    <div className="prep">
      {lesson && (
        <>
          <p className="prep-head">К уроку · прошлый урок {formatDate(lesson.date)}{lesson.title ? ` · ${lesson.title}` : ""}</p>
          <button className="secondary" type="button" disabled={lessonWords.length === 0} onClick={() => onStart(lessonWords)}>
            Повторить урок ({lessonWords.length})
          </button>
        </>
      )}
      {questions.length > 0 && (
        <>
          <p className="muted" style={{ marginTop: "0.75rem" }}>Спросить на уроке:</p>
          <ul>
            {questions.map((w) => (
              <li key={w.id}><span dir={dirOf(w.lang)}>{w.term}</span>{w.translation ? <span className="muted"> — {w.translation}</span> : null}</li>
            ))}
          </ul>
        </>
      )}
    </div>
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
      {/* Откуда вопрос — видно всегда: своя фраза, урок, перевод или словарь.
          Вопрос может быть на другом языке, чем ответ: направление письма — своё. */}
      <p className="prompt-label muted">{cloze.label}</p>
      <p className="cloze" dir={cloze.dir}>{cloze.prompt}</p>

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

function RevealCard({ word, onAnswer, listen }) {
  const [revealed, setRevealed] = useState(0);
  // На слух слово сначала звучит и не показывается: мозг должен привыкнуть
  // к звукам языка, иначе он отбрасывает их как шум.
  const [termShown, setTermShown] = useState(!listen);

  useEffect(() => {
    if (listen) speak(word.term, word.lang, savedVoice(word.lang));
  }, [word.id]);

  if (!termShown) {
    return (
      <div className="listen">
        <WordImage word={word} />
        <button className="listen-again" onClick={() => speak(word.term, word.lang, savedVoice(word.lang))}>
          🔊
        </button>
        <p className="muted">Послушай и вспомни слово</p>
        <button className="primary" onClick={() => setTermShown(true)}>Показать слово</button>
      </div>
    );
  }

  return (
    <>
      <WordImage word={word} />
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
          <RootLine word={word} />
          <Family word={word} />
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

function ReviewScreen({ queue, onFinished, listen, practice = false }) {
  const [cards, setCards] = useState(queue);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState(null);
  const word = cards[index];

  if (!word) {
    return (
      <div className="done">
        <p className="done-title">{practice ? "Урок повторён" : "На сегодня хватит"}</p>
        <p className="muted">Повторено слов: {queue.length}</p>
        <button className="primary" onClick={onFinished}>Вернуться</button>
      </div>
    );
  }

  async function answer(known) {
    setError(null);
    try {
      // Повторение к уроку коробки не трогает: это прогон, а не расписание.
      if (!practice) await reviewWord(word.id, known);
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

  // Строгий режим берёт вопрос по приоритету: своя фраза → фраза урока →
  // перевод → значение из словаря (см. promptFor). Ничего нет — раскрытие.
  // На слух строгий ввод выключен: слушать и писать одновременно — уже другое
  // упражнение. На слух тренируется узнавание, строгий режим — воспроизведение.
  const cloze = listen ? null : promptFor(word);

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
        <RevealCard key={word.id} word={word} onAnswer={answer} listen={listen} />
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

  // Слово могло измениться на сервере — например, значение пришло из Pealim.
  // Без этого в полях остаётся старый черновик и следующее «Сохранить»
  // затирает только что полученное.
  useEffect(() => { setDraft(word); }, [word.id, word.updatedAt]);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
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
        <span className="word-row-term" dir={dirOf(word.lang)}>{word.question ? "? " : ""}{word.term}</span>
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
      <RootLine word={word} />

      <label className="field-label">Перевод</label>
      <input
        dir="ltr"
        value={draft.translation}
        onChange={(e) => setDraft({ ...draft, translation: e.target.value })}
      />

      <label className="field-label">Картинка</label>
      <WordImage word={word} />
      <input
        dir="ltr"
        placeholder="вставь адрес картинки и нажми «Сохранить картинку»"
        value={draft.imageUrl ?? ""}
        onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
      />
      <button
        className="secondary"
        disabled={busy || !draft.imageUrl}
        onClick={() => run(() => saveImage(word.id, draft.imageUrl))}
      >
        Сохранить картинку
      </button>
      <button
        className="secondary"
        disabled={busy}
        onClick={() => run(() => drawImage(word.id))}
      >
        Нарисовать образ
      </button>
      <p className="muted">
        Картинка скачивается и остаётся в приложении: ссылки генераторов живут часы.
        Рисование уместнее для абстрактных слов — конкретные лучше искать глазами
        и выбирать тот образ, что запал.
      </p>
      <a
        className="quiet"
        href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(word.term)}`}
        target="_blank"
        rel="noreferrer"
      >
        Найти образ — выбери тот, что запал, а не первый попавшийся
      </a>

      <div className="row-actions">
        <button
          className="secondary"
          disabled={busy}
          onClick={() => run(() => fromPealim(word.id))}
        >
          Из Pealim
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => run(() => updateWord(word.id, { question: !word.question }))}
        >
          {word.question ? "Спросила — снять «?»" : "Не поняла — «?»"}
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
  const [listen, setListen] = useState(false);
  const [practice, setPractice] = useState(false);
  const [lessons, setLessons] = useState([]);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const [words, lessons] = await Promise.all([listWords(), listLessons()]);
      setWords(words);
      setLessons(lessons);
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

  async function startReview(limit, byEar = false) {
    try {
      setQueue(await dueWords(limit, lang));
      setListen(byEar);
      setPractice(false);
      setView("review");
    } catch (err) {
      setError(err.message);
    }
  }

  // Накануне урока: все слова прошлого урока, не только просроченные,
  // и без записи в расписание.
  function startLessonReview(words) {
    setQueue(words);
    setListen(false);
    setPractice(true);
    setView("review");
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

      {view !== "review" && view !== "practice" && (
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

      {view !== "review" && view !== "practice" && dueCount > 3 && (
        <button className="quiet" onClick={() => startReview(3)}>
          Нет сил — только 3 слова
        </button>
      )}

      {/* Вход в сессию, а не настройка: настройка была бы лишним решением. */}
      {view !== "review" && view !== "practice" && dueCount > 0 && canSpeak() && (
        <button className="quiet" onClick={() => startReview(10, true)}>
          Повторять на слух
        </button>
      )}

      {view !== "review" && view !== "practice" && (
        <button className="quiet" onClick={() => setView("practice")}>
          Фразы: формы глагола и предлоги
        </button>
      )}

      {view !== "review" && view !== "practice" && <PrepBlock words={mine} lessons={lessons} onStart={startLessonReview} />}

      {error && <p className="error">{error}</p>}

      {(showHelp || words.length === 0) && <Help lang={lang} />}

      {view === "practice" && <PracticeScreen lang={lang} onFinished={() => { setView("add"); reload(); }} />}
      {view === "day" && <DayScreen lang={lang} onChanged={reload} />}
      {view === "add" && <AddScreen onAdded={reload} />}
      {view === "words" && <WordsScreen words={mine} onChanged={reload} />}
      {view === "review" && (
        <ReviewScreen
          queue={queue}
          listen={listen}
          practice={practice}
          onFinished={() => { setView("add"); reload(); }}
        />
      )}

      {db && <p className="footer">Database: {db}</p>}
    </main>
  );
}
