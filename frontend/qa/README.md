# Браузерные проверки (headless Chromium)

Запуск: сервер в режиме прода на отдельной SQLite с импортированным заданием Hebreway (нужны предложения с аудио):
```
cd backend && SQLITE_STORAGE=/tmp/qa.sqlite NODE_ENV=production PORT=3077 DATABASE_URL= node server.js
# импорт: POST /api/import/lesson {json: <task.import.json>} → POST /api/import/lesson/apply
PY=~/Documents/AI-Workshop/.claude/skills/product-demo-director/.venv/bin/python   # playwright + chromium
$PY frontend/qa/listen-first.py http://localhost:3077 /tmp/shots
$PY frontend/qa/listen-first-audio-failed.py http://localhost:3077 /tmp/shots
```
Audio подменяется в странице (`window.Audio`), чтобы считать воспроизведения и имитировать сбой загрузки.
