# Debt Ledger

A personal Progressive Web App for tracking money you have lent out: who borrowed it, why, when it is expected back, every repayment they have made, and exactly how much is still pending.

Built to live on an iPhone home screen.

---

## Why this exists

Most "who owes me money" notes collapse the moment someone pays you back in parts. You write ₹5,000, they hand you ₹1,000, and you cross out 5,000 and write 4,000 — and the fact that they originally borrowed ₹5,000 is gone forever.

This app refuses to do that.

- The **original borrowed amount is never modified by a repayment.**
- Every repayment is a **separate record** with its own amount, date, method and note.
- **Outstanding is always derived**, never stored:

  ```
  Outstanding = Original Borrowed Amount − Sum of Repayments
  ```

The only way to change what someone originally borrowed is to explicitly edit the debt, which exists for correcting a typo — and even then the database refuses to take it below what has already been repaid.

---

## Features

**The financial model**

- **Borrowers** — a person. **Debts** — one row per borrowing occasion. **Repayments** — one row per installment returned.
- Lending to the same person again adds a new debt; it never overwrites or merges with the last one.
- Unlimited partial repayments per debt, each preserved permanently with its own date and note.
- Repayments can be corrected or deleted; balances recalculate automatically.
- **Mark fully paid** writes a real repayment for the exact outstanding amount, rather than flipping a status flag — the money still has to be accounted for.

**Status, derived not stored**

| Status | Meaning |
| --- | --- |
| **Paid** | Outstanding is zero |
| **Overdue** | Expected return date has passed **and** money is still owed |
| **Due Soon** | Due within the next 3 days **and** money is still owed |
| **Active** | Money is owed and it is not late (a debt with no return date stays here) |

**Screens**

- **Dashboard** — Total Outstanding front and centre, plus Total Lent, Total Repaid, Overdue, Due Soon, and the borrower/debt counts. Overdue and Due Soon lists, and recent activity.
- **Borrowers** — every person with what they borrowed, returned and still owe, with search, status filters and six sort orders.
- **Borrower detail** — their totals, then each borrowing separately with its own repayment history.
- **Debt detail** — original amount, repaid, outstanding, progress, full chronological repayment history.
- **Activity** — a running ledger of every borrowing and repayment, grouped by day, including debts that have gone overdue.
- **Settings** — account, theme, default currency, CSV export, sign out.

**Everything else**

- Email/password auth with persistent sessions and protected routes.
- Row Level Security on every table — one user can never read another's records.
- Indian number formatting (₹1,000 / ₹15,500 / ₹1,25,000), with other currencies configurable.
- WhatsApp reminder shortcut that pre-fills a message and **never sends it**.
- CSV export: borrowers, debts, repayments, and a combined ledger with running balances.
- Dark and light mode, bottom navigation, safe-area support, installable on iOS.
- Offline reading of already-visited screens. Financial writes are **refused** offline rather than queued.

---

## Screenshots

> _Screenshots to be added._
>
> | Dashboard | Borrower detail | Repayment flow |
> | --- | --- | --- |
> | _`docs/screenshots/dashboard.png`_ | _`docs/screenshots/borrower.png`_ | _`docs/screenshots/repayment.png`_ |

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (Radix primitives) |
| Database | Supabase — PostgreSQL with Row Level Security |
| Auth | Supabase Auth (email + password) |
| Validation | Zod, shared between client and server |
| Testing | Vitest |
| Hosting | Vercel |

### A note on money

Amounts are stored as `NUMERIC(14,2)` in Postgres — never floating point. In the application every amount is converted to **integer minor units (paise)** the moment it arrives and all arithmetic happens there, because `0.1 + 0.2 !== 0.3` in binary floats and this app adds up financial records repeatedly. See `src/lib/money.ts`.

---

## Getting started

### Prerequisites

- Node.js 20 or newer
- A free [Supabase](https://supabase.com) project

### Installation

```bash
git clone https://github.com/Aarjav-333/personal-debt-tracker.git
cd personal-debt-tracker
npm install
```

### Environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env.local
```

| Variable | Where to find it | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → `anon` / publishable | Yes |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally; your production URL when deployed | Yes |

> **The `service_role` key is not used anywhere in this project and must never be added to it.** It bypasses Row Level Security, and the app has no server-side need for it. Only the `anon` key ships to the browser, and it can read nothing without a valid session.

### Local development

```bash
npm run dev        # start on http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest
npm run build      # production build
```

---

## Supabase setup

### 1. Create the project

Create a new project at [supabase.com/dashboard](https://supabase.com/dashboard) and note the **Project URL** and **anon key** from Project Settings → API.

### 2. Run the migration

Everything — tables, constraints, indexes, triggers, views, functions, RLS policies and grants — is in a single migration file:

```
supabase/migrations/20260922090000_init_schema.sql
```

**Option A — Supabase dashboard (no tooling needed)**

1. Open your project → **SQL Editor** → **New query**.
2. Paste the entire contents of the migration file.
3. Click **Run**.

**Option B — Supabase CLI**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### 3. Configure authentication

In **Authentication → Providers**, make sure **Email** is enabled.

- Leave **Confirm email** on for a normal setup. The confirmation link lands on `/auth/callback`, which is already implemented.
- For a single-user personal ledger you may prefer to turn **Confirm email** off, so signing up logs you straight in.

In **Authentication → URL Configuration**, set:

- **Site URL** → your production URL (e.g. `https://personal-debt-tracker.vercel.app`)
- **Redirect URLs** → add both `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback`

### 4. Create your account

Start the app, go to `/signup`, and create your ledger. A `profiles` row is created automatically by the `on_auth_user_created` trigger.

### What the schema guarantees

The database is the last line of defence, not just a store:

- `original_amount` and `amount` must be **greater than zero** — no zero or negative entries.
- **Total repayments can never exceed a debt's original amount.** The check locks the debt row first, so two repayments recorded at the same moment cannot both pass a stale balance check.
- A debt **cannot be corrected downwards below what has already been repaid** against it.
- A repayment's `borrower_id` is **derived from its debt by a trigger**, never trusted from the client, so the two can never disagree.
- Composite foreign keys on `(id, user_id)` make it **structurally impossible** for a debt or repayment to reference another user's rows.
- `expected_return_date` cannot precede `borrowed_date`.
- Deleting a borrower cascades to their debts and repayments; deleting a debt cascades to its repayments.

### Row Level Security

RLS is enabled on `profiles`, `borrowers`, `debts` and `repayments`, with separate `select` / `insert` / `update` / `delete` policies scoped to `auth.uid()`. The `anon` role has its grants **revoked outright**, so a policy mistake alone could not expose anything. The three views (`debt_balances`, `borrower_balances`, `activity_feed`) use `security_invoker = true`, so they inherit the same policies rather than bypassing them.

---

## Installing on your iPhone

1. Open the deployed URL in **Safari** (not Chrome — only Safari can install a PWA on iOS).
2. Tap **Share** → **Add to Home Screen**.
3. Launch it from the home screen.

It then runs in standalone mode: no browser chrome, its own icon, safe-area-aware layout, and a persistent session so you are not asked to sign in every time.

**Offline behaviour.** Screens you have already opened will still load without a connection. Anything that writes — adding a debt, recording a repayment, editing a record — is refused with *"You're offline. Connect to the internet to save changes."* This is deliberate: a repayment that silently syncs hours later, possibly out of order, is worse than one that was never recorded.

---

## Deploying to Vercel

1. Push to GitHub.
2. Import the repository at [vercel.com/new](https://vercel.com/new).
3. Add the three environment variables from `.env.example` for **Production**, **Preview** and **Development**. Set `NEXT_PUBLIC_SITE_URL` to your Vercel URL.
4. Deploy.
5. Go back to Supabase → **Authentication → URL Configuration** and add your production URL as the Site URL and `https://<your-domain>/auth/callback` as a redirect URL.

Or from the CLI:

```bash
npx vercel login
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add NEXT_PUBLIC_SITE_URL production
npx vercel --prod
```

---

## Project structure

```
src/
  app/
    (auth)/            sign in, sign up
    (main)/            dashboard, borrowers, debts, activity, settings, add
    api/export/        CSV downloads
    auth/callback/     email confirmation landing
    offline/           served by the service worker with no connection
  components/
    app/               application components
    ui/                shadcn/ui primitives
  hooks/
  lib/
    money.ts           minor-unit arithmetic and Indian formatting
    dates.ts           timezone-safe DATE handling
    debt-status.ts     Active / Due Soon / Overdue / Paid
    aggregate.ts       the single source of every on-screen total
    activity.ts        the ledger timeline
    validators.ts      Zod schemas shared by forms and Server Actions
    supabase/          browser and server clients
  server/
    actions/           Server Actions (the only write path)
    queries.ts         the read path
  proxy.ts             session refresh and route protection
supabase/migrations/   the complete schema
scripts/               icon generation
tests/                 Vitest suites
```

### How data flows

Reads happen in Server Components through `src/server/queries.ts`. Writes happen in Server Actions in `src/server/actions/`, which validate with Zod, call Supabase with the user's own session (so RLS applies), and return a typed result instead of throwing — a failed write always produces a visible message. After every mutation the authenticated layout is revalidated, so no screen can show a balance another screen has already moved past.

---

## Testing

```bash
npm test
```

The suite covers minor-unit arithmetic and Indian formatting, timezone-safe date handling and status derivation, and walks the full set of ledger scenarios end to end: a new debt, successive partial repayments, full settlement, editing a repayment, deleting a repayment, a second borrowing from the same person, and an overdue partial debt where only the unpaid remainder counts as overdue. It also asserts that the dashboard totals always equal the sum of the per-borrower summaries.

---

## License

Personal project. Use it however you like.
