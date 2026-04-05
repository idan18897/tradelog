# TradingLog — Project Context for Claude

## Overview
A personal trading journal web app with a paid subscription model. Users log live trades and missed opportunities, track performance via a calendar and dashboard, and analyze patterns over time.

**Live URL:** https://tradelog-ivory.vercel.app  
**Landing page:** https://tradelog-ivory.vercel.app/landing  
**GitHub:** `idan18897/tradelog` (auto-deploy on push to `main`)  
**Local dev:** `npm run dev` in `C:\Users\IdAvr\tradelog`

---

## Tech Stack
- **Frontend:** React 18 + Vite
- **Routing:** React Router v6
- **Styling:** Inline styles + Tailwind utilities + CSS variables (dark/light theme)
- **Charts:** Recharts
- **Drag & Drop:** @dnd-kit/core + @dnd-kit/sortable
- **Backend:** Supabase (Auth + PostgreSQL + Storage)
- **Payments:** Stripe (Checkout + Webhooks)
- **Deployment:** Vercel (auto-deploy on push to main, serverless API functions)

---

## File Structure

```
src/
  App.jsx                        # Routes + Providers + WelcomeModal trigger
  index.css                      # Global styles, CSS variables (dark/light)
  main.jsx
  context/
    AuthContext.jsx              # Supabase auth (login/signup/logout/Google OAuth)
    ThemeContext.jsx             # Dark/light mode
    LanguageContext.jsx          # i18n translations (English only currently)
    UserSettingsContext.jsx      # Global user settings + plan + goals from Supabase
  components/
    Layout.jsx                   # Shell with Sidebar + TopNav
    Sidebar.jsx                  # Navigation
    TopNav.jsx                   # Mobile nav / header
    DatePicker.jsx               # Custom date picker component
    TradingLogIcon.jsx           # Logo SVG
    UpgradeModal.jsx             # Paywall modal shown when free tier limit hit
    WelcomeModal.jsx             # Shown once after successful payment redirect
  hooks/
    useIsMobile.js               # Responsive hook (breakpoint 600px)
  pages/
    Login.jsx                    # Login + Signup (email/password + Google OAuth)
    Dashboard.jsx                # Analytics, charts, stat cards, Goals widget, Streak Analysis, Trading Insights
    Journal.jsx                  # Main hub: Live / Opportunity Log / Combined + Calendar + search
    TradeForm.jsx                # Add/Edit trade form (enforces free tier limit, instrument type toggle)
    Settings.jsx                 # User settings, categorized pairs library, exit modes, goals
    Landing.jsx                  # Public marketing page with pricing plans
  lib/
    supabase.js                  # Supabase client init
    utils.js                     # computePnL(trade), computeMissedPotGain(trade) — shared across Dashboard + Journal
api/
  create-checkout-session.js     # Vercel serverless: creates Stripe Checkout session
  stripe-webhook.js              # Vercel serverless: handles Stripe events → updates Supabase
supabase/
  schema.sql                     # Full DB schema reference
```

---

## Subscription / Payments System

### Plans
| Plan | Price | Type |
|------|-------|------|
| Free | $0 | Default, limited to 10 live trades |
| Monthly | $14.99/month | Stripe subscription |
| Yearly | $99/year | Stripe subscription |
| Lifetime | $199 | Stripe one-time payment |

### Flow
1. User clicks plan on `/landing` or hits free tier limit in TradeForm
2. Frontend calls `POST /api/create-checkout-session` with `{ plan, userId, email }`
3. API creates Stripe Checkout session, returns `{ url }`
4. User completes payment on Stripe → redirected to `/?payment=success`
5. Stripe fires webhook to `/api/stripe-webhook`
6. Webhook updates `user_settings` in Supabase: sets `plan`, `stripe_customer_id`, `subscription_status`
7. On `/?payment=success`, `WelcomeModal` is shown once, then query param is cleared

### Free Tier Enforcement
- `TradeForm.jsx` checks `plan === 'free'` before saving
- If user has ≥ 10 live trades → shows `UpgradeModal`
- `plan` is read from `UserSettingsContext` (fetched from Supabase on login)

### Stripe Webhook Events Handled
- `checkout.session.completed` → set plan + stripe_customer_id + status = active
- `customer.subscription.deleted` → set plan = free, status = canceled
- `customer.subscription.updated` → update status

### Environment Variables (set in Vercel)
| Variable | Used in |
|----------|---------|
| `VITE_SUPABASE_URL` | Frontend + webhook |
| `VITE_SUPABASE_ANON_KEY` | Frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhook (bypass RLS) |
| `STRIPE_SECRET_KEY` | Checkout + webhook |
| `STRIPE_MONTHLY_PRICE_ID` | Checkout session |
| `STRIPE_YEARLY_PRICE_ID` | Checkout session |
| `STRIPE_LIFETIME_PRICE_ID` | Checkout session |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |

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
| exit_time | text | HH:MM exit time |
| pair | text | e.g. "XAUUSD" |
| direction | text | "Long" / "Short" |
| entry | numeric | Entry price |
| sl | numeric | Stop loss price |
| tp | numeric | Take profit price |
| sl_pips | numeric | SL in pips (or $ for stocks, points for indices) |
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
| instrument_type | text | "forex" (default) / "stocks" / "indices" |
| shares | numeric | Number of shares (stocks mode) |
| contracts | numeric | Number of contracts (indices mode) |
| point_value | numeric | Dollar value per point (indices mode) |

### `user_settings` table
| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid | PK, FK → auth.users |
| theme | text | "dark" / "light" |
| language | text | |
| default_risk | numeric | |
| default_pair | text | Pre-selected pair for new trades |
| default_outcome | text | Pre-selected outcome for new trades |
| default_risk_pct | numeric | Pre-filled risk % for new trades |
| instrument_type | text | Default instrument mode: "forex" / "stocks" / "indices" |
| pairs | jsonb | Flat array of symbols (legacy + sync) |
| pairs_v2 | jsonb | Categorized: `[{category, symbols: []}]` |
| exit_modes | jsonb | Array of `{name, be_at, levels: [{pct, rr}]}` |
| settings_section_order | jsonb | Order of sections in Settings page |
| form_section_order | jsonb | Order of sections in TradeForm |
| long_color | text | Custom Long direction color (hex) |
| short_color | text | Custom Short direction color (hex) |
| plan | text | "free" / "monthly" / "yearly" / "lifetime" (default: "free") |
| stripe_customer_id | text | Stripe customer ID |
| subscription_status | text | "active" / "canceled" / "inactive" |
| account_size | numeric | Account size in $ for dollar value display |
| show_dollar_values | boolean | Show ($X) next to % P&L values |
| daily_reminder | boolean | Enable daily browser notification |
| reminder_time | text | HH:MM for daily reminder |
| goal_monthly_pnl | numeric | Monthly P&L target (%) |
| goal_win_rate | numeric | Monthly win rate target (%) |
| goal_trades_count | int | Monthly trades count target |
| goal_avg_rr | numeric | Monthly average R:R target |

### `confirmations_library` table
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| label | text | Confirmation name |
| sort_order | int | Display order |

> **Note:** When a new user signs up, trigger `on_auth_user_created` fires `handle_new_user()` which auto-inserts 8 default confirmations (MSS, OB, FVG, Liquidity, BOS, Trend, HTF Align, Session). Uses `SECURITY DEFINER` to bypass RLS.

---

## Key Calculation Logic

### P&L Calculation (`computePnL` in `src/lib/utils.js`)
Used in Dashboard.jsx and Journal.jsx:

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

### R:R Display Priority
- **Calculations:** always use `rr_potential` (auto-calculated from prices)
- **Display (table/detail panel):** always show `pot_rr || rr_potential`

---

## Shared Utilities (`src/lib/utils.js`)
`computePnL` and `computeMissedPotGain` are defined **once** in `utils.js` and imported wherever needed.
Never redefine these functions inline in components.

---

## Pages — Detailed

### Landing (`/landing`) — Public
- Marketing page: hero, features, pricing plans, testimonials
- Pricing buttons call `POST /api/create-checkout-session`
- Unauthenticated users are redirected to `/login` before checkout

### Dashboard (`/`)
- **Date filter:** All Time | Monthly | Yearly | Custom Dates
  - Default on load: **Monthly** (current month)
  - Monthly / Yearly modes show a `← April 2026 →` navigation row
  - Click on month/year label to jump back to current
  - `navOffset` state controls period offset (0 = current)
- Stat cards: Win Rate, Monthly P&L, Avg R:R, Open Trades, Total Trades, Capture Rate, Profit Factor, Avg Hold Time, Expectancy, Max Drawdown, Risk of Ruin
- Toggle: include/exclude missed trades in analytics
- **Monthly Goals widget** — shown below stat cards if any goal is set (Settings → General → Monthly Goals)
  - Progress bars per goal, blue → green when achieved, confetti + toast on 100%
  - Always tracks **current calendar month** regardless of date filter
  - Achievement tracked in `achievedGoalsRef` — won't re-fire until goal dips below 100%
- Charts: Weekly P&L bar chart, Equity curve (area chart)
- **Confirmation Analysis tab**: multi-select filter, combinations (size 2/3/4), best combo 🏆, confirmation × day heatmap
- Performance by Day of Week, Session (London 10–14, NY 15–19), Month, Hour, Pair, Holding Time
- Outcome breakdown, Winners & Losers
- **Streak Analysis section** (below Winners & Losers):
  - 5 stats: Max Win Streak, Max Loss Streak, Avg Win Streak, Avg Loss Streak, Recovery Rate
  - Pattern Analysis: after a loss / after a win / after 2+ losses (win rate cards with progress bar)
  - Streak Timeline: bar chart of last 30 streaks (green = win, red = loss)
- **Trading Insights** — auto-generated at bottom of Overview tab
  - 9 possible insights (best day, best pair, worst pair, confirmations, streaks, etc.)
  - Sorted by impact score, max 6 shown
  - Text rendered with `dangerouslySetInnerHTML` — `<b>` tags become blue spans
  - "pure math, no AI" — data-driven only, min 3 trades per data point
- Recent 5 trades
- PDF report export (weekly or monthly, any date)

### Journal (`/journal`)
Three tabs: **Live | Opportunity Log | Combined**

**Calendar** (shown in all tabs):
- Month navigation with `calMonth` state (persisted to localStorage)
- Grid: `repeat(7, 1fr) 72px` — 7 day columns + weekly summary column
- Day cell: trade count top-right, P&L bottom-right, missed count top-left, missed % bottom-left
- Weekly cell: live P&L (green) + missed potential (amber) separately
- Mobile: `minHeight: 48px` per cell

**Live tab:** Trade table + mini dashboard stats filtered by `calMonth`  
**Opportunity Log tab (backtest):** liveTP + missed trades with stat panels  
**Combined tab:** Both live + missed with stat panels

**Trade table:**
- **Search bar** above filters — real-time search by Pair, Outcome, Direction, Notes, Confirmations
  - 🔍 icon inside input, ✕ clear button, "No trades found for `...`" empty state
- Filters: Pair, Outcome, Direction, Rating, Type, Date range
- Desktop: Date, Entry Time, Pair, Direction, Entry, SL Pips, Pot. R:R, Risk%, Outcome, Rating, Confirmations, Screenshot, Actions
- Mobile: Date, Pair, Outcome, P&L, Actions only
- Delete button available in all tabs (including live trades in Opportunity Log)

**Side Detail Panel:**
- Slide-in from right, 360px wide, `position: sticky, top: 80px`
- Mobile: full-screen overlay (`position: fixed, inset: 0`)
- Shows pair, direction badge, outcome, P&L hero, all trade stats, confirmations, notes
- Actions: Edit (blue), Duplicate, Delete (red)
- "View Full Details" button opens centered modal with screenshots

**Lightbox:**
- Fullscreen, drag-to-pan, scroll-to-zoom
- Toolbar glued directly above image (flex column layout, not floating)
- Keyboard: Esc to close, +/- to zoom, 0 to reset

**Error handling:** Journal wrapped in `JournalErrorBoundary` — runtime crashes show error message instead of black screen.

### TradeForm (`/new`, `/edit/:id`)
- **Free tier check:** on save, if `plan === 'free'` and live trade count ≥ 10 → shows `UpgradeModal`
- **Instrument Type toggle** at top of form (persisted per-trade):
  - 💱 Forex / Metals / Crypto (default) — SL label: "SL Pips", auto-calculated
  - 📈 Stocks / ETFs — SL label: "SL ($)", adds **Shares** field
  - 📊 Indices / Futures — SL label: "SL Points", adds **Contracts** + **Point Value ($)** fields
- **Pair dropdown** — searchable, grouped by category (Forex, Metals, Indices, etc.)
  - Custom dropdown with free-text search, not native `<select>`
- Sections (drag-to-reorder, saved to Supabase `form_section_order`):
  `datetime`, `direction`, `outcome`, `prices`, `risk`, `sl_to_be`, `confirmations`, `rating`, `notes`, `screenshot`, `pot_rr`
- Direction buttons `minHeight: 48px`, Outcome buttons `minHeight: 44px` (mobile friendly)
- Screenshot input: `accept="image/*" capture="environment"` (opens camera on mobile)
- Trade type toggle: Live / Missed
- Loads defaults from user_settings: `default_pair`, `default_risk_pct`, `default_outcome`, `instrument_type`

### Settings (`/settings`)
Tabs: **Trading | General | Account**

**Trading tab** — drag-to-reorder sections:
- **Confirmations Library** — drag to reorder, delete, add new
- **Pairs Library** — categorized by instrument type:
  - 7 default categories: Forex, Metals, Indices, Commodities, Crypto, Stocks, ETFs
  - Add/remove symbols per category
  - Add/remove custom categories
  - Saved as `pairs_v2` JSONB; flat `pairs` also updated for backward compat
- **Default Risk %** — pre-filled in every new trade
- **Default Outcome** — pre-selected outcome in every new trade
- **Default Pair** — pre-selected pair, shown as grouped `<optgroup>` dropdown
- **Default Instrument Type** — 3 buttons: 💱 Forex · 📈 Stocks · 📊 Indices
- **Exit Modes** — define partial exit presets

**General tab:**
- Account Size + Show Dollar Values toggle
- Daily Trade Reminder (browser notification)
- Direction Colors (Long/Short custom hex color pickers)
- Trade Templates
- **Monthly Goals** — 4 inputs: Monthly P&L Target (%), Win Rate Target (%), Trades Count Target, Avg R:R Target
  - Clear (✕) button per goal, saved to Supabase on Save

**Account tab:** Email display, Change Password

---

## Goals & Targets System

### Flow
1. User sets goals in Settings → General → Monthly Goals → Save
2. Dashboard reads goals from `UserSettingsContext`
3. Monthly Goals widget shows progress bars (current month only, ignores date filter)
4. When any goal hits 100%: confetti animation (80 pieces, 4.5s) + gradient toast
5. Achievement tracked in `achievedGoalsRef` — won't re-fire until goal dips below 100%

### Goal columns fetched separately in UserSettingsContext
Goal columns are fetched in a **separate Supabase query** so a missing-column error never breaks main settings (colors, plan, etc.)

---

## Instrument Types System

Three modes that change the TradeForm UI:

| Mode | Key | SL Label | Extra Fields |
|------|-----|----------|-------------|
| Forex / Metals / Crypto | `forex` | SL Pips (auto) | — |
| Stocks / ETFs | `stocks` | SL ($) | Shares |
| Indices / Futures | `indices` | SL Points | Contracts, Point Value ($) |

- Saved to `trades.instrument_type`, `trades.shares`, `trades.contracts`, `trades.point_value`
- Default instrument type saved in `user_settings.instrument_type`
- P&L calculation is unchanged — always uses `rr_potential × risk_pct`

---

## Pairs Library v2

Pairs organized in categories, stored as `user_settings.pairs_v2`:
```json
[
  { "category": "Forex", "symbols": ["EURUSD", "GBPUSD"] },
  { "category": "Metals", "symbols": ["XAUUSD"] }
]
```
- Legacy flat `pairs` array still updated on every save (backward compat with Journal/Dashboard)
- TradeForm loads `pairs_v2` first; falls back to flat `pairs`
- TradeForm pair dropdown is a custom searchable dropdown (not native `<select>`)

---

## Exit Modes System
Saved in `user_settings.exit_modes` as JSONB:
```json
[{ "name": "Standard", "be_at": 3, "levels": [{ "pct": 50, "rr": 3 }] }]
```
- `be_at`: R:R level when SL moves to breakeven
- `levels`: partial exits — `pct` = % of position, `rr` = R:R target

---

## Authentication
- Email/password via Supabase Auth
- Google OAuth via Supabase (`redirectTo: window.location.origin`)
- On signup: trigger creates 8 default confirmations
- Protected routes redirect to `/login` if not authenticated

---

## Theme / Colors

### Dark Mode (`[data-theme="dark"]`)
Deep gray palette — not pure black:
- `--bg: #111113` | `--bg-secondary: #242428`
- `--card: #1E1E22` | `--card-hover: #2A2A2E`
- `--sidebar-bg: #161618`

### Light Mode (`:root`)
Soft macOS gray — not pure white:
- `--bg: #F2F2F7` | `--bg-secondary: #E5E5EA`
- `--card: #FFFFFF`
- `--text: #1C1C1E`

Accent colors (blue, green, red) are **never changed** — only backgrounds/text.

---

## State & Persistence
| State | Where saved |
|-------|------------|
| activeTab (Journal) | localStorage (`journal_tab`) |
| calMonth (Journal) | localStorage (`journal_calMonth`) |
| form_section_order | localStorage + Supabase `user_settings` |
| settings_section_order | localStorage + Supabase `user_settings` |
| Theme | localStorage + Supabase `user_settings` |
| Exit modes | Supabase `user_settings.exit_modes` |
| Confirmations | Supabase `confirmations_library` table |
| plan / subscription | Supabase `user_settings` (updated by Stripe webhook) |
| Monthly goals | Supabase `user_settings` (goal_monthly_pnl etc.) |
| Pairs library | Supabase `user_settings.pairs_v2` + `pairs` |
| Default instrument type | Supabase `user_settings.instrument_type` |

---

## Mobile Responsiveness
- `useIsMobile()` hook at breakpoint 600px, used in Dashboard, Journal, TradeForm
- Dashboard: stat cards 1-column, charts height 170px on mobile
- Journal calendar: `minHeight: 48px` per cell (vs 72px desktop)
- Journal table: mobile shows only Date / Pair / Outcome / P&L / Actions
- TradeForm: direction buttons `minHeight: 48px`, outcome buttons `minHeight: 44px`
- TradeForm screenshots: `capture="environment"` for mobile camera
- **Important:** `useIsMobile()` must be declared inside each component that uses it — not passed as prop or called from module-level functions

---

## Important Conventions
- **Never use `rr_potential` for display** — always show `pot_rr || rr_potential`
- **Always use `rr_potential` for calculations** — derived from actual prices
- `risk_pct` defaults to `0.5` when missing
- All P&L values are in **% of account** (not absolute $)
- `calMonth` format: `"YYYY-MM"` string
- `inCalMonth = t => t.date?.slice(0, 7) === calMonth` — standard filter used everywhere
- **No Hebrew text in the UI** — the user writes in Hebrew but all UI strings must be English
- Goal columns must be fetched in a **separate query** from main settings to avoid crashing on missing columns
- New DB columns must never be mixed into existing queries until confirmed they exist in production
- `pairs_v2` is authoritative; flat `pairs` is kept in sync for backward compat

---

## Supabase SQL Migrations Run
```sql
-- Trades table
ALTER TABLE trades ADD COLUMN IF NOT EXISTS pot_rr numeric;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS exit_time text;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS instrument_type text DEFAULT 'forex';
ALTER TABLE trades ADD COLUMN IF NOT EXISTS shares numeric;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS contracts numeric;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS point_value numeric;

-- User settings table
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS settings_section_order jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS form_section_order jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS long_color text;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS short_color text;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS account_size numeric DEFAULT 10000;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS show_dollar_values boolean DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS daily_reminder boolean DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS reminder_time text DEFAULT '20:00';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS goal_monthly_pnl numeric;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS goal_win_rate numeric;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS goal_trades_count int;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS goal_avg_rr numeric;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS default_pair text;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS pairs_v2 jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS instrument_type text DEFAULT 'forex';

-- handle_new_user() uses SECURITY DEFINER to bypass RLS
```

---

## Features Implemented

### Analytics & Dashboard
- Win Rate, Monthly P&L, Avg R:R, Open Trades, Total Trades, Capture Rate, Profit Factor
- Expectancy per Trade, Max Drawdown, Risk of Ruin, Average Holding Time
- Equity Curve, Weekly P&L chart, Performance by Hour/Day/Month/Session/Pair/Holding Time
- Outcome Breakdown, Winners & Losers, Streak Analysis (with pattern analysis + timeline)
- Trading Insights — auto-generated text insights from trade data
- Monthly Goals widget with progress bars + confetti animation
- Export PDF Report (Weekly/Monthly)

### Journal
- Live / Missed / Combined / Opportunity Log tabs
- Calendar with weekly summary column
- Trade table with sort, filters (pair/outcome/direction/rating), search, Export CSV
- Trade Detail Panel (slide-in) with screenshots lightbox
- Duplicate Trade button

### TradeForm
- Instrument type toggle (Forex / Stocks / Indices) with dynamic field labels
- Save as Template + Load Template dropdown
- Drag-to-reorder sections
- HTF + LTF screenshot upload (drag/drop/paste/camera)
- SL to Breakeven toggle + Exit Modes presets

### Settings
- Confirmations Library (add/edit/delete/reorder)
- Categorized Pairs Library (pairs_v2) with custom categories
- Exit Modes presets
- Default Pair, Default Outcome, Default Risk %
- Default Instrument Type
- Account Size + Show Dollar Values toggle
- Direction Colors (Long/Short custom colors)
- Monthly Goals (4 targets)
- Daily Trade Reminder (browser notification)
- Trade Templates management
- Cancel Subscription / Upgrade Plan

### Infrastructure
- Stripe payments (Monthly $14.99 / Yearly $99 / Lifetime $199)
- Free tier enforcement (10 live trades)
- UpgradeModal + WelcomeModal
- Mobile responsive (breakpoint 600px)
- Dark/Light mode (soft palette — not pure black/white)
- Google OAuth + email/password auth

---

## Known Issues / Notes
- Browser caching on Vercel: if a change doesn't appear, open in Incognito mode
- `rr_potential` is auto-calculated on save from entry/SL/TP; doesn't auto-update if prices change post-save
- Supabase free tier: 3 signups/hour rate limit on email confirmation
- Stripe is currently in **Test Mode** — use card `4242 4242 4242 4242` to test payments
- `exit_time` is used in Holding Time analytics and Trade Detail Panel
- Instrument type fields (shares, contracts, point_value) saved to DB but not yet used in P&L calculations
- Journal is wrapped in `JournalErrorBoundary` — runtime crashes show error message instead of black screen
- Streak Analysis requires ≥3 closed trades (TP/Partial TP/SL/BE) to appear
- Monthly Goals widget requires SQL migrations + at least one goal saved in Settings
- Trading Insights require minimum 3 trades per data point to appear
