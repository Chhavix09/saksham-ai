# Run Doc — SakshamAI (AI-Driven Scheme Matching)

Full-stack app: FastAPI backend (`backend/`, port 8000) + Vite/React frontend (`frontend/`, port 5174, proxying `/api` → http://localhost:8000).

## Reproduce uncommitted artifacts
None required. There are no `.env` files: backend `config.py` and frontend `vite.config.ts` ship working defaults (SQLite `backend/sakshamai.db` auto-created and seeded by `init_db()` on startup; CORS allows `localhost:5173/5174`). Dependencies are already installed in `backend/.venv` and `frontend/node_modules`; if missing, install with:

```bash
cd backend && .venv/Scripts/python -m pip install -r requirements.txt
cd frontend && npm install
```

## Start the backend (detached, port 8000)
Check first: `curl -s -m 5 http://localhost:8000/api/health` — the backend is long-lived and often already running from a previous session; reuse it if healthy instead of starting a second instance.
```bash
powershell -NoProfile -Command "(Start-Process -FilePath 'C:\Users\chhav\OneDrive\Documents\.freebuff\.freebuff\backend\.venv\Scripts\python.exe' -ArgumentList '-m','uvicorn','main:app','--host','127.0.0.1','--port','8000' -WorkingDirectory 'C:\Users\chhav\OneDrive\Documents\.freebuff\.freebuff\backend' -RedirectStandardOutput 'C:\Users\chhav\OneDrive\Documents\.freebuff\.freebuff\.freebuff\backend.log' -RedirectStandardError 'C:\Users\chhav\OneDrive\Documents\.freebuff\.freebuff\.freebuff\backend.log.err' -WindowStyle Hidden -PassThru).Id"
```
Health check: `curl -s http://localhost:8000/api/health` → should return `{"status":"ok",...}` (title "SakshamAI API").

## Start the frontend (detached, port 5174)
```bash
powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory 'C:\Users\chhav\OneDrive\Documents\.freebuff\.freebuff\frontend' -RedirectStandardOutput 'C:\Users\chhav\OneDrive\Documents\.freebuff\.freebuff\.freebuff\vite.log' -RedirectStandardError 'C:\Users\chhav\OneDrive\Documents\.freebuff\.freebuff\.freebuff\vite.log.err' -WindowStyle Hidden -PassThru).Id"
```
Health check: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5174` → 200. The API proxy works when `curl -s http://localhost:5174/api/health` also answers.

Note: `Start-Process` calls may appear to hang in a terminal wrapper (redirection keeps handles open) — the detached server still starts; verify with the curl checks and the PID from `Get-Process`.

## Build for production
```bash
cd frontend && npm run build   # tsc -b && vite build → dist/
```
