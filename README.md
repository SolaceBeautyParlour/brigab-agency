# Brigab Agency

A hostel booking platform for KNUST-area students in Kumasi. Students browse
live bed availability, reserve with a deposit + service fee, and manage
payments from a dashboard. Hostel managers get a free tool to manage bed
status and bookings — no subscription.

This is real, runnable code — not a demo. Payments, SMS, and email are wired
to real providers but will just log to your console until you add API keys.

## What's inside

```
brigab-agency/
  backend/     Node.js + Express API, PostgreSQL, Paystack, SMS, email, cron jobs
  frontend/    React + Vite + Tailwind, talks to the backend over REST
```

## 1. Set up the database

You need a PostgreSQL instance. Easiest path: create a free Postgres database
on [Railway](https://railway.app) or [Render](https://render.com) — both give
you a `DATABASE_URL` connection string immediately.

Locally, if you have Postgres installed:
```bash
createdb brigab
```

Then load the schema:
```bash
cd backend
cp .env.example .env       # fill in DATABASE_URL and the other values below
npm install
npm run migrate            # runs src/db/schema.sql against your database
```

## 2. Backend environment variables

Open `backend/.env` and fill in:

- `DATABASE_URL` — from Railway/Render, or your local Postgres
- `JWT_SECRET` — any long random string (e.g. `openssl rand -hex 32`)
- `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` — from your
  [Paystack dashboard](https://dashboard.paystack.com/#/settings/developers).
  Use the **test** keys until you're ready to take real payments — Paystack's
  test mode works end-to-end with test cards, no real money moves.
- `HUBTEL_CLIENT_ID` / `HUBTEL_CLIENT_SECRET` — from
  [Hubtel](https://hubtel.com) if you want real SMS. Leave blank and the app
  will just log messages to the console instead — everything else still works.
- SMTP settings — same idea, for email receipts. Leave blank to log instead.

Run it:
```bash
npm run dev
```
API runs on `http://localhost:4000`. Visit `http://localhost:4000/health` to
confirm it's alive.

## 3. Frontend

```bash
cd frontend
cp .env.example .env       # points VITE_API_URL at your backend
npm install
npm run dev
```
Opens on `http://localhost:5173`.

## 4. Try it end-to-end locally

1. Sign up as a **manager**, add a hostel, connect a Paystack test subaccount
   (use Paystack's test bank details — their docs list valid test account
   numbers), add a room with a few beds.
2. Sign up as a **student** (different browser tab or incognito), browse to
   that hostel, reserve a bed — you'll be redirected to Paystack's hosted
   checkout using their test card numbers.
3. After payment, check the student's dashboard for the booking, and the
   manager's booking list for the same reservation.
4. Toggle a bed from "taken" back to "available" in the manager view — if
   anyone's on that room's waitlist, they'll get notified automatically
   (check your console log if SMS isn't configured).

## 5. Deploying

- **Frontend → Vercel**: import the `frontend` folder as a project, set
  `VITE_API_URL` to your deployed backend URL in Vercel's environment
  variables.
- **Backend → Railway or Render**: import the `backend` folder, attach a
  Postgres database (Railway/Render can provision one for you), set all the
  env vars from `.env.example` in their dashboard, and set the start command
  to `npm start`.
- After deploying, run `npm run migrate` once against the production
  `DATABASE_URL` to create the tables.

## 6. Before you take real payments

- Switch `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` to live keys.
- Each hostel manager needs to complete Paystack's KYC to get a real
  subaccount — this happens on Paystack's side, budget a few days for it.
- Double check the balance-due-date logic in
  `backend/src/routes/payments.js` — it currently defaults to "21 days from
  booking" as a placeholder. Wire it to your real academic calendar (e.g. a
  `semesters` table with start dates) before launch.
- Swap the in-memory session auth (`frontend/src/api/client.js`) for an
  httpOnly cookie issued by the backend if you want stronger security than a
  token held in page memory.

## What's deliberately not built (matches the original scope)

- E-signed 12-month contracts / legal document generation
- ID and guarantor document upload
- A separate parent portal (parents see the student's receipt instead)
- Any paid tier for managers

## Business model, as implemented

- Managers: free, always.
- Students: pay a flat ₵50 non-refundable service fee + a deposit
  (percentage set per hostel by its manager) at the moment they reserve.
- Deposits route directly to the manager's own Paystack subaccount via
  Paystack's split-payment API — Brigab only ever collects its ₵50 fee. The
  platform never holds hostel rent money.
