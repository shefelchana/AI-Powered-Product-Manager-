import { useCallback, useEffect, useRef, useState } from "react";
import { addExample, addWord, aheadWords, currentLesson, deleteWord, drawImage, dueWords, echoSet, finishLesson, fromPealim, listLessons, startLesson, listWords, practiceSet, preparePractice, progress, recordAttempt, reviewWord, updateWord, wordFamily, wordOfDay } from "./api.js";
import { canSpeak, speak, voicesFor } from "./speech.js";
import { choicesFor, matches, missHint, promptFor } from "./recall.js";
import { audioSrc, dictationStage } from "./listen.js";
import { ECHO_START, MAX_TAKE_SECONDS, echoReduce, micErrorKind, pickMimeType } from "./echo.js";
import { lessonSummary, formatDate } from "./prep.js";
import { startRound, nextStep, applyResult, roundSummary } from "./learn.js";

// Местная дата, не UTC: сервер считает день по Израилю, клиент должен совпадать.
const todayISO = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const isDue = (word) => word.nextDue <= todayISO();
const dirOf = (lang) => (lang === "he" ? "rtl" : "ltr");
// Стадия словами, не «коробка 3»: номер коробки — внутренняя механика.
// В списке слов — только «выучено» (вспомнилось после 16-дневной паузы, список из
// /api/progress). Сроки следующего показа пользователю не нужны (Анна, 12.09);
// стадии колоды целиком видны в блоке «Прогресс».
const stageOf = (word, learnedIds = []) => (learnedIds.includes(word.id) ? "выучено" : "");
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

// Слово, которое не держится (три промаха и больше, картинки нет) — повод
// нарисовать образ. Предложение, не автоматика: рисуем по нажатию.
const SUGGEST_IMAGE_AFTER = 3;
let drawAvailable = true;
function ImageSuggestion({ word }) {
  const [state, setState] = useState("idle");
  if (!drawAvailable || word.hasImage || (word.misses ?? 0) < SUGGEST_IMAGE_AFTER || state === "done") return null;
  async function draw() {
    setState("busy");
    try { await drawImage(word.id); setState("done"); } catch { setState("idle"); }
  }
  return (
    <button className="quiet" type="button" disabled={state === "busy"} onClick={draw}>
      {state === "busy" ? "Рисую образ…" : "Не держится — нарисовать образ?"}
    </button>
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

function Help({ lang, db }) {
  return (
    <div className="help">
      <p><strong>Как этим пользоваться</strong></p>
      <ol>
        <li><strong>На занятии</strong> — вкладка «Добавить»: вбей слово и жми Enter. Перевод и объяснение можно не заполнять, это делается потом.</li>
        <li><strong>Дома</strong> — вкладка «Слова»: нажми на слово, чтобы поправить опечатку, или возьми значение, корень и биньян из Pealim одной кнопкой.</li>
        <li><strong>Каждый день</strong> — вкладка «Слово дня»: одно слово, с которым живёшь весь день. Придумал фразу — записал. Фразы потом всплывают на повторении.</li>
        <li><strong>Повторение</strong> — «Повторять»: не больше 10 слов за раз. Сначала вспомни сам, потом открывай. Нет сил — есть кнопка на три слова.</li>
      </ol>
      <p className="muted">К слову можно добавить <strong>картинку</strong> — свой яркий образ, а не первую попавшуюся: слово с образом цепляется заметно лучше. На карточке есть кнопка 🔊 — слово можно послушать в любой момент.</p>
      <p className="muted">Языки разделены сами: иврит, английский и русский живут отдельными списками, переключатель наверху появляется, когда есть что переключать.</p>
      <p className="muted">Слово возвращается через 0, 1, 3, 7 и 16 дней — первый раз в тот же день, потому что забывается быстрее всего в первые сутки.</p>
      <VoicePicker lang={lang} />
      {db && <p className="muted footer">База: {db}</p>}
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
      {/* Почему именно это слово — правило видно, а не спрятано (Анна, 12.09). */}
      {word.reason && <p className="day-reason">{word.reason}</p>}
      <WordImage word={word} />
      <p className="day-term" dir={dirOf(word.lang)}>
        {word.term} <SpeakButton text={word.term} lang={word.lang} />
      </p>
      <p className="muted">Прочитай вслух — так запоминается лучше</p>

      {word.translation && <p className="translation" dir="ltr">{word.translation}</p>}
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
          <button className="secondary" type="button" onClick={toggle}>Закончить урок</button>
        </>
      ) : (
        <button className="secondary" type="button" onClick={toggle}>Начать урок</button>
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
  const [translation, setTranslation] = useState("");
  const [phrases, setPhrases] = useState("");
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const termInput = useRef(null);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const word = await addWord({ term, translation, examples: phrases });
      // Успех — и только успех — очищает поля.
      setTerm("");
      setTranslation("");
      setPhrases("");
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

      {/* Объяснение на иврите здесь не нужно: его дают словари и преподаватель.
          Что нужно от Анны — перевод и фразы, в которых слово встретилось (14.09). */}
      <details className="extra">
        <summary>Перевод и фразы</summary>
        <label className="field-label" htmlFor="translation">Перевод (необязательно)</label>
        <input
          id="translation"
          dir="ltr"
          autoComplete="off"
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
        />
        <label className="field-label" htmlFor="phrases">Фразы с этим словом — каждая с новой строки</label>
        <textarea
          id="phrases"
          dir="rtl"
          rows={3}
          value={phrases}
          onChange={(e) => setPhrases(e.target.value)}
          placeholder="משפט עם המילה"
        />
      </details>

      <button className="primary" type="submit" disabled={saving}>
        {saving ? "Сохраняю…" : "Сохранить"}
      </button>

      {status && <p className={status.kind === "error" ? "error" : "ok"}>{status.text}</p>}
    </form>

    </>
  );
}


// ---------- импорт разбора урока ----------


// Аудио преподавателя с сайта ульпана: файл лежит в их хранилище (адрес — audioSrc в listen.js).
// Один играющий звук на кнопку: новый запуск глушит предыдущий, а обещание старого
// play() не считается — иначе медленно грузящееся аудио «прослушивалось» бы уже на
// следующем предложении (и StrictMode в dev не удваивал бы счётчик).
function startAudio(src, slot, onPlayed, onFailed) {
  slot.current?.pause();
  const audio = new Audio(src);
  slot.current = audio;
  audio.play()
    .then(() => { if (slot.current === audio) onPlayed(); })
    .catch(() => { if (slot.current === audio) onFailed(); });
}

function AudioButton({ file, big = false, autoPlay = false, onPlayed = null, onFailed = null, label = "🔊 Послушать ещё раз" }) {
  const src = audioSrc(file);
  const slot = useRef(null);
  // Колбэки через ref: эффект зависит только от src/autoPlay, но зовёт свежие обработчики.
  const handlers = useRef({ onPlayed, onFailed });
  handlers.current = { onPlayed, onFailed };
  const play = () => startAudio(src, slot, () => handlers.current.onPlayed?.(), () => handlers.current.onFailed?.());
  useEffect(() => {
    if (autoPlay) startAudio(src, slot, () => handlers.current.onPlayed?.(), () => handlers.current.onFailed?.());
    return () => { slot.current?.pause(); slot.current = null; };
  }, [src, autoPlay]);
  if (big) {
    return (
      <button className="secondary listen-big" type="button" onClick={play}>
        {label}
      </button>
    );
  }
  return (
    <button className="listen-again" type="button" onClick={play} aria-label="Прослушать">
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
  // «Слушать до текста»: диктант начинается с прослушиваний без поля ввода.
  const [plays, setPlays] = useState(0);
  const [writing, setWriting] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const listen = dictationStage({ kind: ex?.kind, writing, result, plays, audioFailed });
  const listening = listen.listening;

  async function check(event) {
    event.preventDefault();
    const ok = matches(typed, ex.answer);
    setResult(ok ? "ok" : "miss");
    try { await recordAttempt(ex.wordId, ex.formId, ok, ex.sentenceId ?? null); } catch { /* журнал — не повод останавливать практику */ }
  }

  function next() {
    setTyped("");
    setResult(null);
    setPlays(0);
    setWriting(false);
    setAudioFailed(false);
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
      <p className="prompt-label muted">
        {ex.group ? `глагол «поперёк»: одно лицо, все времена · шаг ${ex.step} из ${ex.steps}` : { form: "форма глагола", preposition: "предлог с местоимением", sentence: "предложение целиком", dictation: listening ? "на слух: сначала просто послушай" : "на слух: напиши, что услышала" }[ex.kind]}
      </p>
      {ex.kind === "dictation" ? (
        result === null && (
          <div className="listen-stage">
            <AudioButton key={ex.sentenceId} file={ex.audioUrl} big autoPlay onPlayed={() => { setPlays((n) => n + 1); setAudioFailed(false); }} onFailed={() => setAudioFailed(true)} label={plays === 0 ? "🔊 Послушать" : "🔊 Послушать ещё раз"} />
            {listening && (
              <>
                <p className="muted listen-count">прослушано: {plays}</p>
                <p className={listen.stage === "failed" ? "listen-hint error" : "listen-hint"}>{listen.hint}</p>
                {listen.canWrite && <button className="primary" type="button" onClick={() => setWriting(true)}>Написать</button>}
                <button className="quiet" type="button" onClick={() => setResult("gaveup")}>Не разобрала</button>
              </>
            )}
          </div>
        )
      ) : (
        <p className="cloze" dir="ltr">{ex.prompt}</p>
      )}
      {ex.kind !== "sentence" && ex.kind !== "dictation" && <p className="form-label" dir="ltr">{ex.label}</p>}

      {result === null && !listening && (
        <form onSubmit={check}>
          {ex.kind === "sentence" || ex.kind === "dictation" ? (
            <textarea className="term-input sentence-input" dir="rtl" autoFocus rows={3} value={typed} onChange={(e) => setTyped(e.target.value)} />
          ) : (
            <input className="term-input" dir="rtl" autoFocus autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          )}
          <button className="primary" type="submit">Проверить</button>
          <button className="quiet" type="button" onClick={() => setResult("gaveup")}>{ex.kind === "dictation" ? "Не разобрала" : "Не помню"}</button>
        </form>
      )}

      {result !== null && (
        <div className="verdict">
          {result === "ok" && <p className="ok">Верно ✓</p>}
          {result === "miss" && (
            <>
              <p className="muted">Ты написала:</p>
              <p className="typed" dir="rtl">{typed}</p>
              {(ex.kind === "form" || ex.kind === "preposition") && missHint(typed, ex.answer) && <p className="miss-hint">{missHint(typed, ex.answer)}</p>}
            </>
          )}
          <p className="review-term" dir="rtl">
            {ex.answerVocalized || ex.answer}{" "}
            {ex.audioUrl ? <AudioButton file={ex.audioUrl} autoPlay={ex.kind === "dictation"} /> : <SpeakButton text={ex.answer} lang="he" />}
          </p>
          {ex.kind === "dictation" && <p className="muted" dir="ltr">{ex.translation}</p>}
          {ex.kind === "dictation" && <p className="muted listen-hint" dir="ltr">читай глазами под звук — так слово «сшивается» со звучанием</p>}
          {ex.kind !== "sentence" && ex.kind !== "dictation" && <p className="muted">{ex.term} · {ex.label}</p>}
          <button className="primary" onClick={next}>Дальше</button>
        </div>
      )}
    </div>
  );
}

// ---------- произношение: эхо за преподавателем ----------

// Голос записывается в браузере и живёт до «Дальше» или выхода: на сервер не уходит.
// Микрофон включается на время дубля и гаснет по «Стоп» — индикатор записи не горит весь подход.
function EchoScreen({ onFinished }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [index, setIndex] = useState(0);
  const [echo, setEcho] = useState(ECHO_START);
  const [takeUrl, setTakeUrl] = useState("");
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef(null);
  const takeRef = useRef("");
  const alive = useRef(true);
  const starting = useRef(false);
  const dispatch = (action) => setEcho((prev) => echoReduce(prev, action));

  function dropTake() {
    if (takeRef.current) URL.revokeObjectURL(takeRef.current);
    takeRef.current = "";
    setTakeUrl("");
  }
  function killRecorder() {
    const rec = recorder.current;
    recorder.current = null;
    if (rec) {
      rec.onstop = null;
      if (rec.state !== "inactive") { try { rec.stop(); } catch { /* уже остановлен */ } }
      rec.stream.getTracks().forEach((t) => t.stop());
    }
  }

  function load() {
    setError(null); setItems(null);
    echoSet(6).then((list) => { if (alive.current) setItems(list); }).catch((e) => { if (alive.current) { setError(e.message); setItems([]); } });
  }

  useEffect(() => {
    alive.current = true;
    load();
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setEcho((prev) => echoReduce(prev, { type: "nomic", reason: "нужен https" }));
    } else if (typeof window !== "undefined" && (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")) {
      setEcho((prev) => echoReduce(prev, { type: "nomic", reason: "браузер не умеет записывать" }));
    }
    return () => { alive.current = false; killRecorder(); if (takeRef.current) URL.revokeObjectURL(takeRef.current); takeRef.current = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Секунды дубля и автостоп: забытая запись не идёт бесконечно.
  useEffect(() => {
    if (echo.stage !== "recording") { setSeconds(0); return undefined; }
    const started = Date.now();
    const timer = setInterval(() => {
      const passed = Math.floor((Date.now() - started) / 1000);
      setSeconds(passed);
      if (passed >= MAX_TAKE_SECONDS) stop();
    }, 250);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [echo.stage]);

  const ex = items?.[index];

  async function record() {
    if (starting.current || recorder.current?.state === "recording") return;
    starting.current = true;
    const forId = ex?.id;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      starting.current = false;
      if (!alive.current) return;
      const kind = micErrorKind(e);
      dispatch({ type: kind.permanent ? "nomic" : "micfail", reason: kind.reason });
      return;
    }
    starting.current = false;
    // Пока ждали разрешения, она ушла с экрана или нажала «Дальше» — не начинать.
    if (!alive.current || ex?.id !== forId || recorder.current) { stream.getTracks().forEach((t) => t.stop()); return; }
    const mimeType = pickMimeType((t) => MediaRecorder.isTypeSupported(t));
    let rec;
    try {
      rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      dispatch({ type: "micfail", reason: "формат записи не поддерживается" });
      return;
    }
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (recorder.current === rec) recorder.current = null;
      if (!alive.current) return;
      const blob = new Blob(chunks, { type: chunks[0]?.type || rec.mimeType || "audio/webm" });
      if (chunks.length === 0 || blob.size === 0) { dispatch({ type: "empty" }); return; }
      dropTake();
      takeRef.current = URL.createObjectURL(blob);
      setTakeUrl(takeRef.current);
      dispatch({ type: "stop" });
    };
    recorder.current = rec;
    rec.start();
    setEcho((prev) => echoReduce(prev, { type: prev.stage === "compare" ? "again" : "record" }));
  }

  function stop() {
    const rec = recorder.current;
    if (rec && rec.state === "recording") rec.stop();
  }

  function next() {
    killRecorder();
    dropTake();
    dispatch({ type: "next" });
    setIndex((i) => i + 1);
  }

  if (items === null) return <div className="review"><p className="muted">Собираю предложения с аудио…</p></div>;
  if (error) {
    return (
      <div className="done">
        <p className="done-title">Не получилось загрузить</p>
        <p className="error">{error}</p>
        <button className="primary" onClick={load}>Попробовать ещё раз</button>
        <button className="quiet" onClick={onFinished}>Вернуться</button>
      </div>
    );
  }
  if (!ex) {
    return (
      <div className="done">
        <p className="done-title">{items.length === 0 ? "Пока нечего повторять" : "Произношение отработано"}</p>
        <p className="muted">{items.length === 0 ? "Нужны предложения урока с аудио преподавателя (импорт с сайта ульпана)" : `Повторила: ${items.length}`}</p>
        <button className="primary" onClick={onFinished}>Вернуться</button>
      </div>
    );
  }

  const step = { listen: "1 · слушай и читай под звук", recording: `2 · говори — идёт запись, ${seconds} с`, compare: "3 · сравни: преподаватель и ты" }[echo.stage];
  return (
    <div className="review strict echo">
      <p className="review-head">
        <span className="muted">{index + 1} из {items.length}{ex.wrong ? " · была ошибка на сайте" : ""}</span>
        <button className="exit" onClick={onFinished}>Выйти</button>
      </p>
      <p className="prompt-label muted" aria-live="polite">{step}</p>
      <p className="review-term echo-text" dir="rtl">{ex.heVocalized || ex.he}</p>
      <p className="muted" dir="ltr">{ex.ru}</p>
      {echo.note && <p className="muted listen-hint" aria-live="polite">{echo.note}</p>}

      {echo.stage === "listen" && (
        <div className="listen-stage">
          <AudioButton key={ex.id} file={ex.audioUrl} big autoPlay label="🔊 Преподаватель" />
          {echo.mic && <button className="primary" type="button" onClick={record}>⏺ Записать себя</button>}
          <button className="quiet" type="button" onClick={next}>Дальше</button>
        </div>
      )}
      {echo.stage === "recording" && (
        <div className="listen-stage">
          <p className="recording-dot">● повтори предложение вслух (до {MAX_TAKE_SECONDS} с)</p>
          <button className="primary" type="button" onClick={stop}>⏹ Стоп</button>
        </div>
      )}
      {echo.stage === "compare" && (
        <div className="listen-stage">
          <div className="review-menu-row">
            <AudioButton file={ex.audioUrl} big label="🔊 Преподаватель" />
            <AudioButton file={takeUrl} big label={`🔊 Я${echo.takes > 1 ? ` · дубль ${echo.takes}` : ""}`} />
          </div>
          <button className="secondary" type="button" onClick={record}>⏺ Записать ещё раз</button>
          <button className="primary" type="button" onClick={next}>Дальше</button>
        </div>
      )}
    </div>
  );
}

// ---------- учить: раунд как в Quizlet Learn ----------

// Слово сначала узнаётся (выбор из четырёх), потом вспоминается (написание).
// Ошибка возвращает на ступень назад и ставит слово в конец очереди раунда.
// В расписание уходит один ответ на слово, когда раунд закончен.
function LearnScreen({ queue, pool, onFinished, ahead = false }) {
  const [round, setRound] = useState(() => startRound(queue, pool));
  const [step, setStep] = useState(() => nextStep(startRound(queue, pool)));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const total = round.queue.length;
  const mastered = round.queue.filter((q) => q.mastered).length;

  useEffect(() => {
    if (step !== null || saved) return;
    // Раунд закончен: записываем ответы в расписание, один на слово.
    (async () => {
      const { known, unknown } = roundSummary(round);
      try {
        // Вне расписания режим «ahead»: сервер пишет журнал, коробку на «знаю» не двигает.
        for (const id of known) await reviewWord(id, true, ahead ? "ahead" : "learn");
        for (const id of unknown) await reviewWord(id, false, ahead ? "ahead" : "learn");
      } catch (e) {
        setError(e.message);
      } finally {
        setSaved(true);
      }
    })();
  }, [step, saved]);

  function result(ok) {
    const next = applyResult(round, step, ok);
    setRound(next);
    setStep(nextStep(next));
  }

  if (step === null) {
    const s = roundSummary(round);
    return (
      <div className="done">
        <p className="done-title">Раунд закончен</p>
        <p className="muted">Освоено: {s.mastered} из {s.total}{s.unknown.length ? ` · с ошибками: ${s.unknown.length}, они вернутся сегодня` : ""}</p>
        {error && <p className="error">{error}</p>}
        <button className="primary" onClick={onFinished} disabled={!saved}>{saved ? "Дальше" : "Записываю…"}</button>
      </div>
    );
  }

  return (
    <div className="review">
      <p className="review-head">
        <span className="muted">освоено {mastered} из {total}</span>
        <button className="exit" onClick={onFinished}>Выйти</button>
      </p>
      <div className="progress"><div className="progress-fill" style={{ width: `${(mastered / Math.max(total, 1)) * 100}%` }} /></div>
      {step.stage === "choose" ? (
        <ChoiceCard key={`${step.word.id}-c`} word={step.word} choice={step.choice} onAnswer={result} />
      ) : step.cloze ? (
        <StrictCard key={`${step.word.id}-t`} word={step.word} cloze={step.cloze} onAnswer={result} onRequeue={() => result(false)} />
      ) : (
        <RevealCard key={`${step.word.id}-r`} word={step.word} onAnswer={result} listen={false} />
      )}
    </div>
  );
}

// ---------- повторять: входы ----------

// Одна вкладка — все способы повторить. Раньше эти входы висели над каждым
// экраном и на телефоне отодвигали поле ввода на второй экран.
function ReviewMenu({ dueCount, onReview, onAhead, onPractice, onEcho, prep, progress }) {
  return (
    <div className="review-menu">
      {dueCount === 0 ? (
        <>
          <p className="muted">На сегодня всё повторено.</p>
          {/* Вне расписания: «знаю» коробку не двигает, промах возвращает слово на сегодня. */}
          <button className="primary" onClick={() => onAhead(7, "learn")}>Повторить ещё: узнать, потом написать</button>
          <div className="review-menu-row">
            <button className="secondary" onClick={() => onAhead(10, "type")}>Только написать по переводу</button>
            <button className="secondary" onClick={() => onAhead(10, "choose")}>Только выбрать из четырёх</button>
          </div>
          <p className="muted small">Это вне расписания: «знаю» ничего не меняет, промах вернёт слово на сегодня.</p>
        </>
      ) : (
        <>
          <p className="muted">К повторению: {dueCount}</p>
          <button className="primary" onClick={() => onReview(7, false, "learn")}>Учить: узнать, потом написать</button>
          <div className="review-menu-row">
            <button className="secondary" onClick={() => onReview(10, false, "type")}>Только написать по переводу</button>
            <button className="secondary" onClick={() => onReview(10, false, "choose")}>Только выбрать из четырёх</button>
          </div>
        </>
      )}
      <div className="review-menu-row">
        {dueCount > 3 && <button className="secondary" onClick={() => onReview(3, false, "learn")}>Нет сил — только 3</button>}
        <button className="secondary" onClick={onPractice}>Фразы: формы и предлоги</button>
      </div>
      <div className="review-menu-row">
        <button className="secondary" onClick={onEcho}>Произношение: повтори за преподавателем</button>
      </div>
      {prep}
      {progress}
    </div>
  );
}

// ---------- к уроку ----------

// Накануне урока: слова прошлого урока целиком (не только просроченные),
// без записи в расписание, и список «?» — что спросить.
function PrepBlock({ words, lessons, onStart }) {
  const { lesson, words: lessonWords } = lessonSummary(words, lessons);
  if (!lesson || lessonWords.length === 0) return null;
  const title = lesson.title ? lesson.title.replace(/ · Hebreway$/, "") : `урок ${formatDate(lesson.date)}`;
  return (
    <div className="prep">
      <p className="prep-head">К уроку: {title}</p>
      <button className="secondary" type="button" onClick={() => onStart(lessonWords)}>
        Повторить урок ({lessonWords.length})
      </button>
    </div>
  );
}

// ---------- повторение ----------

// Выбор перевода из четырёх: слово на иврите → какой перевод. Это узнавание,
// а не воспроизведение, поэтому режим второй, не вместо строгого. Варианты —
// переводы других слов колоды: похожие по теме, значит честные.
function ChoiceCard({ word, choice, onAnswer }) {
  const [picked, setPicked] = useState(null);
  const done = picked !== null;
  const right = done && picked === choice.correct;

  useEffect(() => {
    if (!right) return undefined;
    const timer = setTimeout(() => onAnswer(true), 800);
    return () => clearTimeout(timer);
  }, [right]);

  return (
    <div className="strict">
      <p className="prompt-label muted">какой перевод?</p>
      <p className="review-term" dir="rtl">{word.term} <SpeakButton text={word.term} lang={word.lang} /></p>
      <div className="choices4">
        {choice.options.map((option, i) => {
          const cls = !done ? "choice" : i === choice.correct ? "choice choice-right" : i === picked ? "choice choice-wrong" : "choice choice-dim";
          return (
            <button key={i} className={cls} disabled={done} onClick={() => setPicked(i)} dir="ltr">
              {option}
            </button>
          );
        })}
      </div>
      {done && !right && (
        <div className="verdict">
          <p className="muted">Верно: {choice.options[choice.correct]}</p>
          <button className="primary" onClick={() => onAnswer(false)}>Дальше</button>
        </div>
      )}
      {done && right && <p className="ok">Верно ✓</p>}
    </div>
  );
}

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
      <WordImage word={word} />
      <p className="prompt-label muted">{cloze.label}</p>
      <p className="cloze" dir={cloze.dir}>{cloze.prompt}</p>
      {cloze.hint && <p className="hint muted" dir="rtl">{cloze.hint}</p>}

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
              {missHint(typed, cloze.answer) && <p className="miss-hint">{missHint(typed, cloze.answer)}</p>}
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
              <ImageSuggestion word={word} />
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
          <ImageSuggestion word={word} />
        </div>
      )}
    </>
  );
}

function ReviewScreen({ queue, pool = [], onFinished, onMore, listen, mode = "type", practice = false, ahead = false }) {
  const [cards, setCards] = useState(queue);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState(null);
  const word = cards[index];

  if (!word) {
    return (
      <div className="done">
        <p className="done-title">{practice ? "Урок повторён" : "На сегодня хватит"}</p>
        <p className="muted">Повторено слов: {queue.length}</p>
        {/* Продолжить — выбор после финиша, а не бесконечная лента: «ещё» никогда не по умолчанию. */}
        {!practice && onMore && <button className="secondary" onClick={onMore}>Ещё 10</button>}
        <button className="primary" onClick={onFinished}>Вернуться</button>
      </div>
    );
  }

  async function answer(known) {
    setError(null);
    try {
      // Повторение к уроку коробки не трогает: это прогон, а не расписание.
      // Вне расписания ответ тоже уходит: сервер пишет журнал и сам не двигает коробку на «знаю».
      if (!practice) await reviewWord(word.id, known, ahead ? "ahead" : listen ? "listen" : mode);
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
  const cloze = listen || mode === "choose" ? null : promptFor(word);
  const choice = mode === "choose" && !listen ? choicesFor(word, pool) : null;

  return (
    <div className="review">
      <p className="review-head">
        <span className="muted">{index + 1} из {cards.length}</span>
        <button className="exit" onClick={onFinished}>Выйти</button>
      </p>

      {choice ? (
        <ChoiceCard key={word.id} word={word} choice={choice} onAnswer={answer} />
      ) : cloze ? (
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

function WordRow({ word, open, onToggle, onChanged, canDraw = true, learnedIds = [] }) {
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
        <span className="word-row-term" dir={dirOf(word.lang)}>{word.term}</span>
        <span className="word-row-side">
          <span className="word-row-tr" dir="ltr">{word.translation || <em className="muted">без перевода</em>}</span>
          <span className="muted word-row-stage">{stageOf(word, learnedIds)}</span>
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
      {/* Один способ: приложение рисует образ по переводу. Поиск и ручной адрес
          ушли — три кнопки на одно действие делали картинку слишком дорогой. */}
      {canDraw ? (
        <button className="secondary" disabled={busy || !(word.translation || word.definition)} onClick={() => run(() => drawImage(word.id))}>
          {busy ? "Рисую…" : word.hasImage ? "Перерисовать образ" : "Нарисовать образ"}
        </button>
      ) : (
        <p className="muted">Рисование выключено: на сервере не задан ключ GEMINI_API_KEY.</p>
      )}

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

// Прогресс без стриков: куда движется колода, что держится через неделю,
// что не держится, по урокам, в какие дни повторяла.
const STAGE_ORDER = [["new", "новое"], ["day1", "через день"], ["day3", "через 3 дня"], ["week", "через неделю"], ["settling", "закрепляется"], ["learned", "выучено"]];
function ProgressBlock({ report, stats, onLesson }) {
  if (!report) return null;
  const total = Object.values(report.stages).reduce((a, b) => a + b, 0) || 1;
  const pct = (n) => Math.round((n / total) * 100);
  const ret = report.retention;
  return (
    <details className="progress-block">
      <summary>Прогресс</summary>
      <div className="stage-bar" aria-hidden="true">
        {STAGE_ORDER.map(([k]) => report.stages[k] > 0 && <span key={k} className={`stage-seg stage-${k}`} style={{ width: `${pct(report.stages[k])}%` }} />)}
      </div>
      <p className="muted stage-legend">
        {STAGE_ORDER.filter(([k]) => report.stages[k] > 0).map(([k, name]) => `${name} ${report.stages[k]}`).join(" · ")}
      </p>
      <p className="muted">
        Своих фраз: <strong>{stats.phrases}</strong>
        {stats.pending > 0 && <> · без перевода: <strong>{stats.pending}</strong></>}
      </p>
      <p>
        Удержание через неделю и дольше:{" "}
        {ret.asked === 0 ? <span className="muted">ещё нечего мерить — ни одно слово не возвращалось после недели</span> : <strong>{Math.round((ret.correct / ret.asked) * 100)}%</strong>}
        {ret.asked > 0 && <span className="muted"> ({ret.correct} из {ret.asked})</span>}
      </p>
      <p className="activity" aria-label="дни с повторением за две недели">
        {report.activeDays.map((d) => <span key={d.date} className={d.active ? "dot on" : "dot"} title={d.date} />)}
        <span className="muted"> дни с повторением, две недели</span>
      </p>
      {report.hard.length > 0 && (
        <p className="muted hard-words">Не держится:{" "}
          {report.hard.map((h) => <span key={h.id} className="chip"><bdi dir="rtl">{h.term}</bdi> <small>{h.misses}</small></span>)}
        </p>
      )}
      {report.lessons.length > 0 && (
        <div className="lesson-list">
          <p className="muted">По урокам — можно повторить слова любого занятия, без записи в расписание:</p>
          {report.lessons.slice(0, 6).map((l) => (
            <div key={l.id} className="lesson-row">
              <span>
                {l.title.replace(/ · Hebreway$/, "") || l.date}
                <span className="muted"> · держится {l.holding} из {l.total}{l.learned ? `, выучено ${l.learned}` : ""}</span>
              </span>
              <button className="secondary small-btn" type="button" onClick={() => onLesson(l.id)}>Повторить</button>
            </div>
          ))}
        </div>
      )}
      {report.forms.length > 0 && (
        <p className="muted">Формы: {report.forms.slice(0, 6).map((f) => `${f.label} ${f.correct}/${f.asked}`).join(" · ")}</p>
      )}
    </details>
  );
}

function WordsScreen({ words, onChanged, canDraw = true, learnedIds = [] }) {
  const [openId, setOpenId] = useState(null);

  if (words.length === 0) {
    return <p className="muted">Слов пока нет. Начни с вкладки «Добавить».</p>;
  }

  // Сначала то, у чего нет перевода: это и есть список дел. Потом новые.
  const sorted = [...words].sort((a, b) => {
    const byTranslation = Number(Boolean(a.translation)) - Number(Boolean(b.translation));
    return byTranslation !== 0 ? byTranslation : b.id - a.id;
  });

  return (
    <div>
      {sorted.map((word) => (
        <WordRow
          key={word.id}
          word={word}
          open={openId === word.id}
          onToggle={() => setOpenId(openId === word.id ? null : word.id)}
          onChanged={onChanged} canDraw={canDraw} learnedIds={learnedIds}
        />
      ))}
    </div>
  );
}

// ---------- оболочка ----------

export default function App() {
  const [words, setWords] = useState([]);
  const [db, setDb] = useState("");
  const [features, setFeatures] = useState({ draw: true });
  const [view, setView] = useState("add");
  const [showHelp, setShowHelp] = useState(false);
  const [lang, setLang] = useState("he");
  const [queue, setQueue] = useState([]);
  const [listen, setListen] = useState(false);
  const [practice, setPractice] = useState(false);
  const [ahead, setAhead] = useState(false);
  const [mode, setMode] = useState("type");
  const [lessons, setLessons] = useState([]);
  const [report, setReport] = useState(null);
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
      .then((data) => { setDb(data.db); drawAvailable = Boolean(data.features?.draw); setFeatures({ draw: drawAvailable }); })
      .catch(() => setDb(""));
  }, []);

  // Списки языков раздельные: иврит учится отдельно от английского.
  const mine = words.filter((word) => word.lang === lang);

  // Отчёт о прогрессе живёт на «Повторять»; вкладке «Слова» нужен только список выученных.
  useEffect(() => {
    let ignore = false;
    progress(lang).then((r) => { if (!ignore) setReport(r); }).catch(() => { if (!ignore) setReport(null); });
    return () => { ignore = true; };
  }, [lang, words]);
  const counts = words.reduce((acc, word) => ({ ...acc, [word.lang]: (acc[word.lang] ?? 0) + 1 }), {});
  const otherLangs = Object.keys(LANGS).filter((code) => code !== lang && counts[code]);

  const dueCount = mine.filter(isDue).length;
  const pending = mine.filter((word) => !word.translation).length;
  const learned = mine.filter((word) => word.box === 5).length;
  const phrases = mine.reduce((sum, word) => sum + exampleList(word).length, 0);

  async function startReview(limit, byEar = false, how = "type", aheadMode = false) {
    try {
      const next = aheadMode ? await aheadWords(limit, lang) : await dueWords(limit, lang);
      await reload();
      if (next.length === 0) { setView("reviewmenu"); return; }
      setQueue(next);
      setListen(byEar);
      setMode(how);
      setPractice(false);
      setAhead(aheadMode);
      setView("review");
    } catch (err) {
      setError(err.message);
    }
  }

  // Накануне урока: все слова прошлого урока, не только просроченные,
  // и без записи в расписание.
  function startLessonReview(words) {
    if (words.length === 0) return;
    setQueue(words);
    setListen(false);
    setPractice(true);
    setAhead(false);
    // Режим «учить» пишет в расписание по итогам раунда — прогон урока идёт строгим режимом.
    if (mode === "learn") setMode("type");
    setView("review");
  }

  return (
    <main>
      <header className="top">
        <h1>Слова с занятий</h1>
        <button className="quiet help-toggle" onClick={() => setShowHelp(!showHelp)}>
          {showHelp ? "Свернуть" : "Как пользоваться"}
        </button>
      </header>

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

      {view !== "review" && view !== "practice" && (
        <nav className="nav">
          <button className={view === "day" ? "tab active" : "tab"} onClick={() => setView("day")}>
            Слово дня
          </button>
          <button className={view === "add" ? "tab active" : "tab"} onClick={() => setView("add")}>
            Добавить
          </button>
          <button className={view === "reviewmenu" ? "tab active" : "tab"} onClick={() => setView("reviewmenu")}>
            Повторять{dueCount > 0 ? ` · ${dueCount}` : ""}
          </button>
          <button className={view === "words" ? "tab active" : "tab"} onClick={() => setView("words")}>
            Слова · {mine.length}
          </button>
        </nav>
      )}

      {error && <p className="error">{error}</p>}

      {(showHelp || words.length === 0) && <Help lang={lang} db={db} />}

      {view === "reviewmenu" && (
        <ReviewMenu
          dueCount={dueCount}
          onReview={(limit, byEar, how) => startReview(limit, byEar, how)}
          onAhead={(limit, how) => startReview(limit, false, how, true)}
          onPractice={() => setView("practice")}
          onEcho={() => setView("echo")}
          prep={<PrepBlock words={mine} lessons={lessons} onStart={startLessonReview} />}
          progress={<ProgressBlock report={report} stats={{ phrases, pending }} onLesson={(id) => startLessonReview(mine.filter((w) => w.lessonId === id))} />}
        />
      )}
      {view === "practice" && <PracticeScreen lang={lang} onFinished={() => { setView("reviewmenu"); reload(); }} />}
      {view === "echo" && <EchoScreen onFinished={() => setView("reviewmenu")} />}
      {view === "day" && <DayScreen lang={lang} onChanged={reload} />}
      {view === "add" && <AddScreen onAdded={reload} />}
      {view === "words" && <WordsScreen words={mine} onChanged={reload} canDraw={features.draw} learnedIds={report?.learnedIds ?? []} />}
      {view === "review" && mode === "learn" && (
        <LearnScreen key={queue.map((w) => w.id).join(",")} queue={queue} pool={mine} ahead={ahead} onFinished={() => { setView("reviewmenu"); reload(); }} />
      )}
      {view === "review" && mode !== "learn" && (
        <ReviewScreen
          key={queue.map((w) => w.id).join(",")}
          queue={queue}
          listen={listen}
          pool={mine}
          mode={mode}
          practice={practice}
          ahead={ahead}
          onFinished={() => { setView("reviewmenu"); reload(); }}
          onMore={() => startReview(10, listen, mode, ahead)}
        />
      )}
    </main>
  );
}
