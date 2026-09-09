# Run Doc — GramVenture AI

## Reproduce uncommitted artifacts
None required — the project is a standard Vite + React + TypeScript app with all source in the repository.

## Install dependencies
```bash
export PATH="/c/Program Files/nodejs:$APPDATA/npm:$PATH"
npm install
```

## Start dev server
```bash
export PATH="/c/Program Files/nodejs:$APPDATA/npm:$PATH"
nohup node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173 > /tmp/vite-dev.log 2>&1 &
```
Default port: 5173. Falls back to 5174 if in use. Current: **5174**.

## Build for production
```bash
npm run build
# Output in dist/
```
