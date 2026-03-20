# Environment variables

## Where they live

| File           | Committed? | Purpose                                      |
|----------------|------------|----------------------------------------------|
| `.env.example` | Yes        | Template — copy to `.env.local`              |
| `.env.local`   | No         | Your real keys (gitignored)                  |

Expo / Metro loads `.env`, `.env.local`, `.env.development`, etc. from the **project root** automatically. Variables used in the app must be prefixed with `EXPO_PUBLIC_`.

## Required for the mobile app

Defined in `lib/supabase.ts`:

- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL  
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase **anon** (public) key  

Get both from: **Supabase Dashboard → Project Settings → API**.

## Edge Functions & cron (not in `.env.local`)

These are set in the **Supabase Dashboard** (or `supabase secrets set` when deploying functions), for example:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` (if your function checks it)

Never add `SUPABASE_SERVICE_ROLE_KEY` to `EXPO_PUBLIC_*` — it would be embedded in the client bundle.

## Quick setup

```bash
cp .env.example .env.local
# Edit .env.local with your URL and anon key, then:
npx expo start --clear
```
