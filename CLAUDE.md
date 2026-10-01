# Viriato Hub — agent guide

Internal web app for Viriato's teams (installable via Safari → File → Add to Dock). Read this file, then follow **Session start** before touching anything.

## Session start
1. Read `README.md`, `package.json`, `vite.config.ts`, `vercel.json`.
2. Read every file under `src/` (`lib/`, `components/`, `pages/`).
3. Read the SQL in `supabase/migrations/` in order — source of truth for data model, triggers and RLS.
4. Run `git log --oneline -20`.
5. Reply with a 10-line architecture summary, anything fragile or missing, and "Ready — what do you want to build?". Then **wait for instructions**; do not change anything unprompted.

## Facts
- Live: https://viriato-hub.vercel.app — push to `main` = auto-deploy on Vercel (project `viriato-hub`).
- Repo: github.com/antonioviriatomkt/viriato-hub
- Backend: Supabase project `viriato-hub`, ref `hzxtcnfeilauvlpztpuo`, region eu-west-1.
  Env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` live in `.env.local` (never committed) and in Vercel.
- Stack: Vite + React 19 + TypeScript (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly`) + Tailwind v4 + react-router v8 + @supabase/supabase-js; PWA via vite-plugin-pwa.
- Data model: `profiles` (admin / member / pending), `teams`, `team_members`, `meetings` (title, scheduled_at, objective, status planned/done/cancelled), `meeting_notes`, `meeting_log` (append-only, filled by triggers + manual entries).
- RLS helpers `is_admin`, `is_active`, `is_team_member`, `can_access_meeting` live in schema `private`; trigger functions in `public` have EXECUTE revoked from anon/authenticated.
- First signup becomes admin; later signups are `pending` until an admin approves them in Administração.

## Conventions
- UI language: European Portuguese (pt-PT), informal "tu". Labels in `src/lib/format.ts`.
- Every feature belongs to a team: new tables get `team_id` and copy the RLS pattern from `meetings`. Nothing ships without RLS.
- Schema change = new file in `supabase/migrations/` (timestamp prefix) → apply it → regenerate `src/lib/database.types.ts` → `npm run build` and `npx oxlint src` must pass.
- Keep the existing look: reuse `src/components/ui.tsx`; no new UI libraries.
- Realtime: subscribe per page as in `src/pages/Meeting.tsx`; never cache Supabase responses in the service worker.
- Small, focused commits with clear messages. Never commit `.env.local`.
- Run the Supabase security advisors after any DDL change and fix all warnings.
