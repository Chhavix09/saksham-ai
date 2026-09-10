# SakshamAI — Upgrade Status & Implementation Plan

## Current state (verified on disk)
- Backend: FastAPI + SQLAlchemy, 11 routers including `assistant.py` (AI chatbot with
  retrieval + provider abstraction: openai/anthropic/gemini/fallback). Config keys:
  `ai_provider`, `ai_api_key`, `ai_model`, `ai_base_url`, `ai_timeout_seconds`,
  `ai_max_output_tokens`, `ai_request_limit_per_minute`.
- Frontend: React+Vite+Tailwind, `ChatAssistant.tsx` widget mounted in RootLayout,
  framer-motion + recharts already dependencies.
- Fixed previously: legacy scheme NULL backfill, admin 403-before-validation, partner
  routing scheme-awareness, optional partner in application flow, stale demo data.
- Tests: `backend/smoke_test.py` (45 checks, all passing). Servers: backend :8000,
  frontend :5174 (both running detached).

## New work this session
1. **ChatLog model** (activity.py): provider, topic, context_keys, latency, success,
   char lengths — NO message content stored (privacy) + index on created_at.
2. **Assistant service/router**: log usage metadata per request (best-effort, never breaks chat).
3. **Admin endpoints** (admin.py, all require_admin):
   - `GET /api/admin/users` — search (name/email/mobile), filter (role, active), paginate
   - `PATCH /api/admin/users/{id}/status` — activate/deactivate (cannot deactivate self/last admin)
   - `GET /api/admin/system` — totals, new users 7d/30d, chatbot usage (total/today/7d/avg latency/
     error rate/provider split), recent registrations, recent registrations, db health (table counts + latency)
4. **Frontend**:
   - `Skeleton.tsx` component; `Toast.tsx` provider with framer-motion animations
   - Chatbot: voice input via webkitSpeechRecognition (graceful fallback), TTS toggle via
     speechSynthesis, copy-response button, markdown-lite rendering (bold/code/links/lists),
     framer-motion message entrance animations, prefers-reduced-motion respected
   - Admin page: new Users tab, System tab with real-data charts (user growth, AI usage),
     animated tab transitions
   - endpoints.ts + types for all new APIs
5. **i18n**: new keys in all 8 locales via script.
6. **Tests**: extend smoke_test.py with admin user management + system + chat logging checks.

## Explicit non-goals
- No message content persistence (privacy by design).
- No new runtime dependencies (web Speech API is browser-native; framer-motion exists).
- Gemini specifics: provider already supported; docs updated to make Gemini the
  documented example (AI_PROVIDER=gemini, AI_API_KEY=...). Key remains server-side only.
