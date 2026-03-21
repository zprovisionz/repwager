# RepWager — locked vision (session doc)

**Paste this file (or `DESIGN_SPEC.md`) at the start of Cursor sessions.**  
Numeric tokens live in [`constants/theme.ts`](constants/theme.ts); typography roles in [`constants/typography.ts`](constants/typography.ts).

---

## Product rules (non-negotiable)

- **No manual rep entry** — pose detection only; grep for `TextInput` rep entry before shipping.
- **League wars** — not in challenge Step 3 opponent selector (no league option there).
- **Purple only for league** — keep non-league surfaces off purple accents except the League tab.
- **Small PRs** — one screen or one concern per task when possible.

---

## Stack

Expo Router · React Native · TypeScript · Supabase · Zustand · TF.js pose detection · **Barlow + Barlow Condensed** (no Inter / Orbitron on new surfaces).

---

## Design language — *Athletic Brutalism*

- Dark backgrounds only · Barlow Condensed for numbers, headings, labels, **buttons (Condensed 900, ALL CAPS, ~0.1em letter-spacing)** · Barlow for body.
- No decorative multi-stop gradients (except single-dimension encodings).
- Thin borders, semantic color.

---

## Color semantics (see `constants/theme.ts`)

| Role | Use |
|------|-----|
| Cyan | Primary / casual |
| Amber | RepCoins, wagers |
| Green | Success |
| Red | Errors / loss |
| Purple | **League only** |
| Fire | Streak heat |

---

## Navigation (tabs)

**Home · Theatre · League (purple) · FAB (create) · Ranks · Profile**

- League hub: stack under `app/leagues/*` · tab entry: `app/(tabs)/league.tsx`
- Ranks: `app/(tabs)/ranks.tsx` (not `leaderboard`)

---

## Challenge flow

- **Create:** 4 steps — Exercise → Stakes → **Opponent (OPEN vs CALLOUT) + submission window (1H/2H/6H/24H) + forfeit copy** → Review with **POST CHALLENGE** + **DISCARD**.
- **Find:** feed vs single open-challenge accept — feed at `app/challenge/index.tsx`, accept/detail at `app/challenge/[id].tsx`.
- **Launch scope:** push-ups only; squats locked in UI + service guard.

---

## Match & result

- Active match: state machine A/B; confirm with detected score; no manual reps.
- Full win/loss UX: primary implementation in `app/match/reveal.tsx`; `app/match/result.tsx` is a thin alias to reveal (see file comment).

---

## Theatre (trust layer)

- **No raw video** in the Theatre player — skeleton / rep timeline / keypoints policy; `expo-av` Video must not be the Theatre playback surface.

---

## Leagues

- Schema: reconcile new tables with [`supabase/migrations/`](supabase/migrations/) before duplicating `theatre_*` or league objects.
- War / standings / bracket / find-create: extend existing `app/leagues/*` screens.

---

## Rank ladder

Single ladder definition: [`types/database.ts`](types/database.ts) `RANK_TIERS` + [`services/elo.service.ts`](services/elo.service.ts) `getRankTier` (ELO → tier). Display uses `RANK_TIER_COLORS` / `RANK_TIER_TAGLINES`.

---

## Gap analysis & build order

See the repo vision alignment notes (implementation order: doc → typography/tabs → home → challenge steps → find feed → match UX → theatre → leagues → squats/tiers). Supabase `submission_window_hours` supports variable windows when present on `matches` and in `accept_match`.

---

## Strict checklist for PRs

- [ ] Tokens from `constants/theme.ts`
- [ ] Buttons: Condensed 900 + caps (shared `Button` component)
- [ ] No new Inter/Orbitron usage
- [ ] League purple only where specified
