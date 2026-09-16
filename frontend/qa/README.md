# Браузерные проверки (headless Chromium)

Запуск: сервер в режиме прода на отдельной SQLite с импортированным заданием Hebreway (нужны предложения с аудио):
```
cd backend && SQLITE_STORAGE=/tmp/qa.sqlite NODE_ENV=production PORT=3077 DATABASE_URL= node server.js
# импорт: POST /api/import/lesson {json: <task.import.json>} → POST /api/import/lesson/apply (с picks, чтобы появились слова)
PY=~/Documents/AI-Workshop/.claude/skills/product-demo-director/.venv/bin/python   # playwright + chromium
$PY frontend/qa/<сценарий>.py http://localhost:3077 /tmp/shots
```
Audio подменяется в странице (`window.Audio`), микрофон — фейковым устройством Chromium.

| Сценарий | Что проверяет |
|---|---|
| `listen-first.py`, `listen-first-audio-failed.py` | диктант: этап прослушивания, сбой звука |
| `echo.py` | «Эхо»: запись, сравнение, отказ микрофона, ни одного POST со страницы |
| `negation.py` | единица «сделай отрицание» |
| `today-step.py` | блок «Сегодня» на экране дня |
| `lesson-phrases.py <слово>` | фразы преподавателя с 🔊 на карточке |
| `words-tab.py` | поиск, секции, длинные термины, «Фразы» без сети (нужны слово без перевода и «להתחרט על») |
| `tutor.py` | разбор промаха и дайджест в «Прогрессе» (ключ Gemini в env) |
| `site-trend.py` | строка ошибок на сайте по датам |
| `day-grouping.py` | уроки по дням, «Повторить» день, дата на карточке |
| `day-screen-v2.py` | экран дня без формы, приветствие, своя фраза на карточке |
| `card-view.py` | карточка: просмотр → «Изменить» → сохранить → просмотр; подтверждение удаления не переживает сохранение |
