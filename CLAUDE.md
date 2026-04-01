# TradingLog — Project Context for Claude

## Overview
A personal trading journal web app. Users log live trades and missed opportunities, track performance via a calendar and dashboard, and analyze patterns over time.

**Live URL:** Deployed on Vercel (connected to `main` branch on GitHub: `idan18897/tradelog`)
**Local dev:** `npm run dev` in `C:\Users\IdAvr\tradelog`

---

## Tech Stack
- **Frontend:** React 18 + Vite
- **Routing:** React Router v6
- **Styling:** Inline styles + Tailwind utilities + CSS variables (dark/light theme)
- **Charts:** Recharts
- **Drag & Drop:** @dnd-kit/core + @dnd-kit/sortable
- **Backend:** Supabase (Auth + PostgreSQL + Storage)
- **Deployment:** Vercel (auto-deploy on push to main)

---

## File Structure

```
src/
  App.jsx                        # Routes + Providers
  index.css                      # Global styles, CSS variables
  main.jsx
  context/
    AuthContext.jsx              # Supabase auth (login/signup/logout/Google OAuth)
    ThemeContext.jsx             # Dark/light mode
    LanguageContext.jsx          # i18n translations (English only currently)
    UserSettingsContext.jsx      # Global user settings from Supabase
  components/
    Layout.jsx                   # Shell with Sidebar + TopNav
    Sidebar.jsx                  # Navigation
    TopNav.jsx                   # Mobile nav / header
    DatePicker.jsx               # Custom date picker component
    TradingLogIcon.jsx           # Logo SVG
  hooks/
    useIsMobile.js               # Responsive hook
  pages/
    Login.jsx                    # Login + Signup (email/password + Google OAuth)
    Dashboard.jsx                # Analytics, charts, stat cards
    Journal.jsx                  # Main hub: Live / Missed / Combined / Opportunity Log + Calendar
    TradeForm.jsx                # Add/Edit trade form
    Settings.jsx                 # User settings, confirmations library, exit modes
  lib/
    supabase.js                  # Supabase client init
```

---

## Database Schema (Supabase)

### `trades` table
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| date | date | YYYY-MM-DD |
| day | text | e.g. "Monday" |
| time | text | HH:MM entry time |
| exit_time | text | HH:MM exit time (added later) |
| pair | text | e.g. "XAUUSD" |
| direction | text | "Long" / "Short" |
| entry | numeric | Entry price |
| sl | numeric | Stop loss price |
| tp | numeric | Take profit price |
| sl_pips | numeric | SL in pips |
| rr_potential | numeric | Auto-calculated from entry/SL/TP prices |
| pot_rr | numeric | Manually entered estimated R:R |
| risk_pct | numeric | Risk % (default 0.5) |
| confirmations | jsonb | Array of confirmation strings |
| outcome | text | "TP" / "Partial TP" / "SL" / "BE" / "Invalid" / "Open" |
| notes | text | Trade notes |
| rating | int | 1–5 star rating |
| screenshot_url | text | HTF screenshot (Supabase Storage) |
| ltf_screenshot_url | text | LTF screenshot (Supabase Storage) |
| week_number | int | ISO week number |
| trade_type | text | "live" (default) / "missed" |
| missed_reason | text | Only for missed trades |
| sl_to_be | boolean | Whether SL moved to breakeven |
| be_at | numeric | R:R level when SL moved to BE (default 3) |
| exit_levels | jsonb | Array of `{pct: number, rr: number}` — partial exit levels |

### `user_settings` table
| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid | PK, FK → auth.users |
| theme | text | "dark" / "light" |
| language | text | |
| default_risk | numeric | |
| default_pair | text | |
| confirmations_library | jsonb | Per-user list (legacy, moved to separate table) |
| exit_modes | jsonb | Array of `{name, be_at, levels: [{pct, rr}]}` |
| settings_section_order | jsonb | Order of sections in Settings page |
| form_section_order | jsonb | Order of sections in TradeForm |

### `confirmations_library` table
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| label | text | Confirmation name |
| sort_order | int | Display order |

> **Note:** When a new user signs up, a trigger `on_auth_user_created` fires `handle_new_user()` which auto-inserts 6 default confirmations (MSS, OB, FVG, Liquidity, BOS, Trend). The function uses `SECURITY DEFINER` to bypass RLS.

---

## Key Calculation Logic

### P&L Calculation (`computePnL` / `calPnL`)
Used in Dashboard.jsx and Journal.jsx — identical logic:

```js
function computePnL(trade) {
  const rr = Number(trade.rr_potential) || 0
  const risk = Number(trade.risk_pct) || 0.5
  if (trade.outcome === 'SL') return -risk
  if (trade.outcome !== 'TP' && trade.outcome !== 'Partial TP') return 0
  const isPartial = trade.outcome === 'Partial TP'
  if (trade.sl_to_be && trade.exit_levels?.length) {
    let rem = 100, gain = 0
    for (const lv of trade.exit_levels) {
      gain += (lv.pct / 100) * lv.rr * risk
      rem -= lv.pct
    }
    if (!isPartial) gain += (rem / 100) * rr * risk
    return gain
  }
  return isPartial ? rr * risk * 0.5 : rr * risk
}
```

**Rules:**
- SL → `-risk%`
- TP with no exit_levels → `rr × risk`
- TP with exit_levels (sl_to_be) → sum of partial exits + remaining at full TP
- **Partial TP** with sl_to_be → only exit levels count, remaining position hit BE = 0
- Partial TP without exit_levels → `rr × risk × 0.5`

### Missed Trade Potential Gain (`computeMissedPotGain`)
Same logic as above but uses `rr_potential || pot_rr` as the fullRR source.

### R:R Display Priority
- **Calculations:** prefer `rr_potential` (auto-calculated from prices)
- **Display (table/detail panel):** prefer `pot_rr` (manually entered by user)
- Code: `const v = trade.pot_rr || trade.rr_potential`

---

## Pages — Detailed

### Dashboard (`/`)
- Stat cards: Win Rate, Monthly P&L, Avg R:R, Open Trades, Total Trades (closed), Capture Rate, Profit Factor
- Date filter: All / Current Year / Custom range
- Toggle: include/exclude missed trades in analytics
- Charts: Weekly P&L bar chart, Equity curve (area chart)
- Performance by Day of Week table
- Performance by Session (London 10–14, New York 15–19)
- Performance by Month (grid)
- Performance by Hour bar chart — **toggle Win Rate / Volume** (trade count)
- Outcome breakdown (TP/SL/BE/Invalid) with progress bars
- Winners & Losers stats
- Consecutive streaks (max wins, max losses, current streak)
- Recent 5 trades list

### Journal (`/journal`)
Four tabs: **Live | Missed | Combined | Opportunity Log**

**Calendar** (shown in all tabs):
- Month navigation with `calMonth` state (persisted to localStorage)
- Calendar grid: `repeat(7, 1fr) 72px` — 7 day columns + weekly summary column
- Day cell shows: trade count top-right, P&L bottom-right, missed count top-left, missed % bottom-left
- Weekly cell shows: live P&L (green) + missed potential (amber) separately
- Last week padded to 7 slots to keep WEEKLY column aligned

**Live tab:**
- Trade table with filters (pair, outcome, direction, search)
- Columns: Date, Time, Pair, Direction, Entry, SL, TP, SL Pips, Pot. R:R, Risk%, Confirmations, Outcome, P&L, Rating, Actions
- **Pot. R:R column shows `pot_rr || rr_potential`** (user's manual value preferred)
- Clickable rows open detail panel
- Mini dashboard at top: Win Rate, Total P&L, Avg R:R, Profit Factor, Avg Win, Avg Loss, Best Trade, Current Streak — all filtered by `calMonth`

**Missed tab:**
- Same table structure but for missed trades
- Shows potential gain per trade

**Combined tab:**
- Shows both live + missed
- Stat panels at top filtered by `calMonth`

**Opportunity Log tab:**
- Calendar view
- "Trades Taken" (green) + "Trades Missed" (amber) stat panels filtered by `calMonth`

**Persistence:**
- `activeTab` saved to localStorage, restored on refresh
- `calMonth` saved to localStorage, restored on refresh

### TradeForm (`/new`, `/edit/:id`)
Sections (drag-to-reorder, order saved to Supabase `form_section_order`):
- `datetime`: Date + Entry Time + Exit Time + Pair
- `direction`: Long/Short toggle
- `prices`: Entry, SL, TP, SL Pips — auto-calculates R:R
- `risk`: Risk % input
- `outcome`: TP / Partial TP / SL / BE / Invalid / Open
- `sl_to_be`: Toggle SL to BE + be_at level + exit_levels (from saved exit modes)
- `confirmations`: Multi-select from user's library
- `rating`: 1–5 stars
- `notes`: Textarea
- `screenshot`: HTF + LTF image upload (drag/drop/paste)
- `pot_rr`: Manual potential R:R estimate

**"Potential Gain if entered" banner:**
- Shows calculated gain using exit_levels if sl_to_be active
- Prefers `rr` (auto-calculated) over `pot_rr` for the calculation

**Trade type toggle:** Live / Missed (missed shows `missed_reason` field)

### Settings (`/settings`)
Sections (drag-to-reorder, order saved to Supabase `settings_section_order`):
- **Confirmations Library:** Add/edit/delete/reorder confirmations per user
- **Exit Modes:** Named presets of `{be_at, levels: [{pct, rr}]}` — e.g. "Standard: SL to BE at 1:3, take 50% at 1:3"
- **Pairs:** Custom pair list
- **Account:** Email display + logout
- **Theme / Language**

---

## Exit Modes System
Saved in `user_settings.exit_modes` as JSONB array:
```json
[{ "name": "Standard", "be_at": 3, "levels": [{ "pct": 50, "rr": 3 }] }]
```
- `be_at`: R:R level at which SL moves to breakeven
- `levels`: Array of partial exits — `pct` = % of position, `rr` = R:R target
- When applied to a trade: sets `sl_to_be=true`, `be_at`, `exit_levels` on the trade

---

## Authentication
- Email/password via Supabase Auth
- Google OAuth via Supabase (`redirectTo: window.location.origin`)
- On signup: trigger creates default confirmations for new user
- Protected routes redirect to `/login` if not authenticated

---

## State & Persistence
| State | Where saved |
|-------|------------|
| activeTab (Journal) | localStorage (`journal_tab`) |
| calMonth (Journal) | localStorage (`journal_cal_month`) |
| form_section_order | localStorage + Supabase `user_settings` |
| settings_section_order | localStorage + Supabase `user_settings` |
| Theme | localStorage + Supabase `user_settings` |
| Exit modes | Supabase `user_settings.exit_modes` |
| Confirmations | Supabase `confirmations_library` table |

---

## Important Conventions
- **Never use `rr_potential` for display** — always show `pot_rr || rr_potential`
- **Always use `rr_potential` for calculations** — it's derived from actual prices
- `risk_pct` defaults to `0.5` when missing
- All P&L values are in **% of account** (not absolute $)
- `calMonth` format: `"YYYY-MM"` string — used to filter all month stats
- `inCalMonth = t => t.date?.slice(0, 7) === calMonth` — standard filter used everywhere

---

## Supabase SQL Migrations Run
```sql
ALTER TABLE trades ADD COLUMN IF NOT EXISTS pot_rr numeric;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS exit_time text;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS settings_section_order jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS form_section_order jsonb;
-- handle_new_user() updated to use SECURITY DEFINER to fix signup bug
```

---

## Known Issues / Notes
- Browser caching on Vercel: if a change doesn't appear, open in Incognito mode
- `rr_potential` is auto-calculated on save from entry/SL/TP; if prices change after save, it doesn't auto-update
- Supabase free tier: 3 signups/hour rate limit on email confirmation
- `exit_time` field added to trades table and TradeForm but not yet used in analytics
