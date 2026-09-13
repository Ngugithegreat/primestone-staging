# PrimeStone

A copy-trading platform front end — landing site, onboarding, a live trading desk and the
full authenticated app. Built with Next.js 16, React 19, TypeScript and Tailwind CSS v4.

> **This is a demonstration project.** It holds no client money, is not authorised by any
> financial regulator, and executes no real orders. Every price, strategy provider, track
> record and balance is simulated in the browser.

## What is in it

**Public site (`/`)**

- Animated hero with a live ticker tape driven by the same price engine as the app
- How copy trading works, the strategy-provider leaderboard, and a feature breakdown of the
  risk controls (proportional sizing, copy stop-loss, audited track records)
- Interactive platform showcase, the four account types, funding methods, testimonials and
  an FAQ

**Onboarding**

- `/signup` — a four-step wizard: details → account type → preferences → confirmation.
  Choosing an account type re-prices execution and caps the leverage options accordingly.
- `/login` — sign in, or load a pre-funded demo account in one click.

**The app**

| Route | What it does |
| --- | --- |
| `/dashboard` | Equity curve, account tiles, active copies with per-provider P&L, open positions, market movers |
| `/traders` | Filter and sort 14 providers by return, win rate, drawdown, risk, market and fee |
| `/traders/[id]` | Full profile: performance curve, monthly returns, risk and fee detail, your copied trades |
| `/trade` | Candlestick chart on 18 instruments across 5 timeframes, order ticket with SL/TP, live positions |
| `/portfolio` | Open exposure, performance attribution by provider, win rate, profit factor, CSV export |
| `/wallet` | Deposits via M-Pesa, crypto, card and bank; withdrawals; transaction history |
| `/settings` | Profile, account type, leverage, verification, security and notifications |

## How the simulation works

There is no backend. Three pieces do the work:

- **`src/lib/market.ts`** — instrument definitions and a seeded OHLC generator. History for a
  given symbol and timeframe is deterministic, so the server render and the client hydration
  produce identical markup. `MarketProvider` then ticks live quotes from one interval.
- **`src/lib/store.ts`** — a Zustand store persisted to `localStorage`, holding the user,
  balance, positions, trade history, copy relationships and transactions. A new account is
  seeded with a plausible back-history so the analytics have something to compute over.
- **`src/components/app/CopyEngine.tsx`** — a headless worker that enforces stop-loss and
  take-profit as quotes move, mirrors new signals from active copies (sized against the
  allocation), and unwinds a copy when it breaches its copy stop-loss.

The chart in `src/components/trade/CandleChart.tsx` is drawn on a 2D canvas — candles,
volume, price axis, crosshair, and overlays for position entries and SL/TP levels.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build    # production build
npm run typecheck
```

## Deploying to Vercel

Import the repository at [vercel.com/new](https://vercel.com/new). Vercel detects Next.js
automatically — there is nothing to configure and no environment variables to set.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 ·
Framer Motion · Recharts · Zustand · lucide-react
