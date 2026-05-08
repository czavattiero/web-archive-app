# Local Development with Supabase + Inbucket

This guide lets you test the full signup → email confirmation → checkout flow locally without sending real emails or hitting Supabase rate limits.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Node.js installed
- Supabase CLI: `npm install -g supabase`

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Start local Supabase
```bash
supabase start
```

This starts all local services. Note the output — you'll need the `anon key` and `service_role key`.

| Service | URL |
|---|---|
| API | http://localhost:54321 |
| Studio (DB UI) | http://localhost:54323 |
| **Inbucket (email)** | **http://localhost:54324** |

### 3. Create your `.env.local`

Copy the example file:
```bash
cp .env.local.example .env.local
```

Then fill in the keys from `supabase start` output:
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → anon key
- `SUPABASE_SERVICE_ROLE_KEY` → service_role key

### 4. Apply the database schema
```bash
supabase db reset
```

This applies all migrations in `supabase/migrations/` to the local database.

### 5. Run the app
```bash
npm run dev
```

App runs at: http://localhost:3000

## Testing signup with Inbucket

1. Go to http://localhost:3000/signup
2. Sign up with any fake email (e.g. `test@example.com`)
3. Open **http://localhost:54324** — the confirmation email will be there
4. Click the confirmation link to complete the flow
5. Repeat with any email — no rate limits!

## Stopping

```bash
supabase stop
```

## Notes

- Local Supabase data is persisted in Docker volumes between restarts
- To reset the DB to a clean state: `supabase db reset`
- Stripe/Resend keys are still needed locally if testing checkout or transactional emails
- For production deployments, configure environment variables in your deployment platform (e.g., Vercel project settings) — do **not** store production secrets in `.env.local`
