# Scheme Up — how to run (frontend preview)

## 1. Reproduce the uncommitted artifacts a fresh checkout needs

- Backend deps (already installed in this machine's global Python 3.11; `pip install` only if missing):
  `python -m pip install -r .freebuff/backend/requirements.txt`
- Frontend deps: `cd .freebuff/frontend && npm install`
- Env files: none required (`.env.example` documents all options; defaults work).
  If a real `.env` exists in the main checkout, copy it to `.freebuff/backend/.env`.
- Database: none required — on first backend start it creates
  `.freebuff/backend/sakshamai.db` (SQLite) and seeds demo schemes, partners and users
  automatically (idempotent, non-destructive).

## 2. Run the servers (both detached)

Backend (FastAPI, port 8000):

```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'python.exe' -ArgumentList '-m','uvicorn','main:app','--port','8000' -WorkingDirectory 'D:\saksham-ai\.freebuff\backend' -RedirectStandardOutput 'D:\saksham-ai\.freebuff\backend-preview.log' -RedirectStandardError 'D:\saksham-ai\.freebuff\backend-preview.err.log' -WindowStyle Hidden -PassThru).Id"
```

Frontend (Vite, port 5174 — proxies `/api` to :8000):

```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory 'D:\saksham-ai\.freebuff\frontend' -RedirectStandardOutput '<preview-log>' -RedirectStandardError '<preview-log>.err' -WindowStyle Hidden -PassThru).Id"
```

Frontend URL: **http://localhost:5174** · API health: http://localhost:8000/api/health
Demo login: `rahul@saksham.demo` / `Demo@12345` (admin: `admin@saksham.demo` / `Admin@12345`)

Note: `npm run dev` may pick 5175 if 5174 is occupied — the preview must use the port
that actually binds. If the backend port is taken, stop the old process or pass `--port 8001`
and set `VITE_API_PROXY_URL=http://localhost:8001` for the frontend.
