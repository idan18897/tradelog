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
  index.css                      # Global styles, CSS variables
  main.jsx
  context/
    AuthContext.jsx              # Supabase auth (login/signup/logout/Google OAuth)
    ThemeContext.jsx             # Dark/light mode
    LanguageContext.jsx          # i18n translations (English only currently)
    UserSettingsContext.jsx      # Global user settings + plan from Supabase
  components/
    Layout.jsx                   # Shell with Sidebar + TopNav
    Sidebar.jsx                  # Navigation
    TopNav.jsx                   # Mobile nav / header
    DatePicker.jsx               # Custom date picker component
    TradingLogIcon.jsx           # Logo SVG
    UpgradeModal.jsx             # Paywall modal shown when free tier limit hit
    WelcomeModal.jsx             # Shown once after successful payment redirect
  hooks/
    useIsMobile.js               # Responsive hook
  pages/
    Login.jsx                    # Login + Signup (email/password + Google OAuth)
    Dashboard.jsx                # Analytics, charts, stat cards
    Journal.jsx                  # Main hub: Live / Missed / Combined / Opportunity Log + Calendar
    TradeForm.jsx                # Add/Edit trade form (enforces free tier limit)
    Settings.jsx                 # User settings, confirmations library, exit modes
    Landing.jsx                  # Public marketing page with pricing plans
  lib/
    supabase.js                  # Supabase client init
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
| exit_modes | jsonb | Array of `{name, be_at, levels: [{pct, rr}]}` |
| settings_section_order | jsonb | Order of sections in Settings page |
| form_section_order | jsonb | Order of sections in TradeForm |
| long_color | text | Custom Long direction color (hex) |
| short_color | text | Custom Short direction color (hex) |
| plan | text | "free" / "monthly" / "yearly" / "lifetime" (default: "free") |
| stripe_customer_id | text | Stripe customer ID |
| subscription_status | text | "active" / "canceled" / "inactive" |

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

### R:R Display Priority
- **Calculations:** always use `rr_potential` (auto-calculated from prices)
- **Display (table/detail panel):** always show `pot_rr || rr_potential`

---

## Pages — Detailed

### Landing (`/landing`) — Public
- Marketing page: hero, features, pricing plans, testimonials
- Pricing buttons call `POST /api/create-checkout-session`
- Unauthenticated users are redirected to `/login` before checkout

### Dashboard (`/`)
- Stat cards: Win Rate, Monthly P&L, Avg R:R, Open Trades, Total Trades, Capture Rate, Profit Factor
- Date filter: All / Current Year / Custom range
- Toggle: include/exclude missed trades in analytics
- Charts: Weekly P&L bar chart, Equity curve (area chart)
- Performance by Day of Week, Session (London 10–14, NY 15–19), Month, Hour
- Outcome breakdown, Winners & Losers, Consecutive streaks, Recent 5 trades

### Journal (`/journal`)
Four tabs: **Live | Missed | Combined | Opportunity Log**

**Calendar** (shown in all tabs):
- Month navigation with `calMonth` state (persisted to localStorage)
- Grid: `repeat(7, 1fr) 72px` — 7 day columns + weekly summary column
- Day cell: trade count top-right, P&L bottom-right, missed count top-left, missed % bottom-left
- Weekly cell: live P&L (green) + missed potential (amber) separately

**Live tab:** Trade table + mini dashboard stats filtered by `calMonth`  
**Missed tab:** Same structure for missed trades  
**Combined tab:** Both live + missed with stat panels  
**Opportunity Log tab:** Calendar with Trades Taken / Trades Missed panels

### TradeForm (`/new`, `/edit/:id`)
- **Free tier check:** on save, if `plan === 'free'` and live trade count ≥ 10 → shows `UpgradeModal`
- Sections (drag-to-reorder, saved to Supabase `form_section_order`):
  `datetime`, `direction`, `prices`, `risk`, `outcome`, `sl_to_be`, `confirmations`, `rating`, `notes`, `screenshot`, `pot_rr`
- Trade type toggle: Live / Missed

### Settings (`/settings`)
Sections (drag-to-reorder, saved to `settings_section_order`):
- Confirmations Library, Exit Modes, Pairs, Account, Theme/Language

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
| plan / subscription | Supabase `user_settings` (updated by Stripe webhook) |

---

## Important Conventions
- **Never use `rr_potential` for display** — always show `pot_rr || rr_potential`
- **Always use `rr_potential` for calculations** — derived from actual prices
- `risk_pct` defaults to `0.5` when missing
- All P&L values are in **% of account** (not absolute $)
- `calMonth` format: `"YYYY-MM"` string
- `inCalMonth = t => t.date?.slice(0, 7) === calMonth` — standard filter used everywhere

---

## Supabase SQL Migrations Run
```sql
ALTER TABLE trades ADD COLUMN IF NOT EXISTS pot_rr numeric;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS exit_time text;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS settings_section_order jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS form_section_order jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS long_color text;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS short_color text;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive';
-- handle_new_user() uses SECURITY DEFINER to bypass RLS
```

---

## Known Issues / Notes
- Browser caching on Vercel: if a change doesn't appear, open in Incognito mode
- `rr_potential` is auto-calculated on save from entry/SL/TP; doesn't auto-update if prices change post-save
- Supabase free tier: 3 signups/hour rate limit on email confirmation
- Stripe is currently in **Test Mode** — use card `4242 4242 4242 4242` to test payments
- `exit_time` field exists in DB and TradeForm but not yet used in analytics
