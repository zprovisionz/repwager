# RepWager — Design Spec

**Living document.** For the **locked vision + strict rules**, read **[`CLAUDE.md`](CLAUDE.md)** first. Paste **`CLAUDE.md`** or this file into Cursor on every session.

> **Default instruction for UI work:** Preserve Supabase + Zustand + navigation params; change presentation only unless explicitly migrating data or schema.

---

## Stack

- Expo Router (file-based navigation)
- React Native + TypeScript
- Supabase (auth + database)
- Zustand (state management)
- TensorFlow.js + `@tensorflow-models/pose-detection` (rep counting)
- **Barlow + Barlow Condensed** (typography; see `constants/typography.ts` + `BarlowText`)

---

## Design language — *Athletic Brutalism*

Visual DNA: sports broadcast graphics + underground fight posters.

- **Dark backgrounds only** (no light mode)
- **Barlow Condensed** for ALL numbers, headings, labels, buttons
- **Barlow Regular** (and Medium/Bold where needed) for **body text only**
- **No gradients** except **single-property** gradients (temperature, intensity) — avoid decorative multi-stop fills unless they encode one dimension (e.g. heat)
- **Thin borders** (1px) with semantic color
- **2px accent line on top** of match type cards (align with `ChallengeCard` / match cards — top rail or specified edge per screen)

---

## Color system

Every color owns a meaning — **never** use them interchangeably:

| Token role | Hex | Meaning |
|------------|-----|---------|
| **Cyan** | `#00C4D4` | Primary action, **casual** matches, default UI |
| **Amber** | `#F0A030` | **RepCoins**, **wager** matches, anything that costs money |
| **Green** | `#1DB87A` | Wins, positive outcomes, confirmed states |
| **Red** | `#E24B4A` | Losses, danger, forfeit, **time pressure** |
| **Purple** | `#8B7FE8` | **League system exclusively** — every league feature is purple |
| **Fire** | `#D85A30` | Streak, heat, intensity |

**Match type rule**

- **CTA button color** tracks match type: **cyan = casual**, **amber = wager**
- **FAB** in bottom nav changes color when in **wager** creation flow
- **Purple** is reserved for league screens — **never** for individual 1v1 matches

Canonical values live in `constants/theme.ts` (`Colors` + `legacyColors`); app-wide imports may use `@/lib/theme` during migration.

---

## Key screens

| Area | Content |
|------|---------|
| **Home** | Stats strip (RC / Record / ELO / Streak) + challenge feed + unlock banner |
| **Profile** | Stats tab (ELO chart, W/L, total reps, PB) / Badges / Wallet / Avatar |
| **Challenge creation** | 4 steps: Exercise → Stakes → Rules → Review |
| **Match find** | Filtered feed with ELO diff badges + match detail |
| **Active match** | Countdown + pose detection notice + confirm score |
| **Result** | VICTORY / DEFEAT hero + scorecard + rematch CTA |
| **League hub** | Banner + war alert + week schedule + top contributors |
| **League war** | Score bar + battle board + contribute CTA |
| **Division standings** | Week tracker + standings + playoff badge |
| **Playoff bracket** | Semis + final + promotion/relegation stakes |
| **League create/find** | Icon picker + privacy toggle + min ELO |
| **Theatre feed** | Category tabs + featured session + compact cards |
| **Session player** | Pose skeleton overlay + match scorecard + reactions |

---

## Anonymization (Theatre)

- All Theatre sessions show **pose skeleton only** (no raw video in public feed)
- Players labeled **"Player #XXXX"** in Theatre
- **Own** sessions visible under **"My Sessions"** (or equivalent) with full context

---

## League system (Madden Mobile–inspired)

- **Commissioner/admin** declares **League Wars** — players do **not** create war battles from the normal challenge flow
- **War points:** Win = 3 pts, Loss = 1 pt
- **Season:** 8 weeks regular + playoff bracket
- **Promotion/relegation** between Bronze / Silver / Gold / Platinum divisions
- **Tier progression:** Rookie → Competitor → Grinder → Beast Mode → **GOGGINS** (2200+ ELO, top 1%)

---

## Component & token file structure

```
constants/
  theme.ts           ← Colors, spacing, radius; legacy flat map for @/lib/theme
  typography.ts      ← Barlow families + BarlowText variant styles
  shadows.ts
components/
  ui/
    BarlowText.tsx   ← all text variants (Condensed vs Barlow body)
    MatchTypeBadge.tsx, ELODiffBadge.tsx, …  ← extend toward unified Badge.tsx over time
    Button.tsx       ← all CTA variants (cyan vs amber vs league purple)
    Card.tsx           surfaces, dividers, rows
    ChallengeCard.tsx  accent rail cards for feeds
```

**Direction:** consolidate pills (match type, ELO diff, result) into a single **`Badge.tsx`** when variants stabilize.

---

## App routes (target vs repo today)

**Target layout (spec):**

```
app/
  (tabs)/
    index.tsx       ← Home
    theatre.tsx     ← Theatre
    league.tsx      ← League hub
    ranks.tsx       ← Leaderboard
    profile.tsx     ← Profile
  challenge/
    create.tsx      ← 4-step creation
    [id].tsx        ← Match detail + accept
  match/
    [id].tsx        ← Active match + confirm
    result.tsx      ← Victory/defeat
  league/
    [id].tsx
    war/[id].tsx
    standings.tsx
    bracket.tsx
    find.tsx
    create.tsx
```

**Repo alignment (current):**

| Spec | Current |
|------|---------|
| `ranks.tsx` | `(tabs)/ranks.tsx` |
| Tab `league.tsx` | `(tabs)/league.tsx` → redirects to `/leagues` stack |
| `challenge/[id].tsx` | Use `challenge/search` + flows as needed; add `[id]` when detail/accept is split out |
| `match/result.tsx` | `match/reveal.tsx` / `match/results.tsx` — add `result` alias route if product wants `/match/result` |

Refactor toward the target tree **without breaking** deep links; use redirects/aliases where routes already ship.

---

## Cursor workflow

1. Keep **this file** as the single source for color meaning, typography rules, and screen order.
2. **One file per prompt** when possible.
3. Always state: *Preserve Supabase + Zustand + navigation params; presentation-only unless noted.*
4. After new primitives land, follow with **“wire into Home / target screen”** to avoid mega-diffs.

---

## Optional dependencies

- `@shopify/flash-list` — long Theatre / league lists
- `react-native-reanimated-carousel` — featured session / bracket carousels
