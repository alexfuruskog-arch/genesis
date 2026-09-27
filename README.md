# ARZIVE — Study with Arzive (Vercel + Convex)

Research-backed notebooks ship from [arzive.com](https://arzive.com) (Shopify). **Study with Arzive** is a separate Next.js app in `frontend/` backed by [Convex](https://convex.dev) for auth, file storage, membership, and Study AI.

## What Study does

- Email-based accounts (same email as Shopify checkout unlocks Plus/Pro).
- Upload notebook scans or lecture files; AI chips: flashcards, quiz, explain, summarize, and free-text questions — grounded on **one selected file**.
- **Free:** one upload per UTC day. **Plus / Pro:** unlimited uploads within fair use (Shopify handles `membership-standard`, `membership-annual` → Plus; `membership-scholar` → Pro).

## Run locally

```bash
cd frontend
cp .env.example .env.local
# Add NEXT_PUBLIC_CONVEX_URL after convex dev prints it
npm install
npx convex dev --start "npm run dev"
```

- Next.js: [http://127.0.0.1:43123](http://127.0.0.1:43123)
- Study UI: [http://127.0.0.1:43123/study](http://127.0.0.1:43123/study)

Without `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` on the Convex deployment, Study AI runs in **mock** mode (deterministic excerpts).

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_CONVEX_URL` | Next.js `.env.local` | Convex client URL |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Convex dashboard | Live LLM (optional) |
| `NEXT_PUBLIC_SHOPIFY_*` | Next.js | Membership product links |

## Deploy

1. **Convex:** `npx convex deploy` from `frontend/`; copy production URL to Vercel as `NEXT_PUBLIC_CONVEX_URL`.
2. **Vercel:** Root directory `frontend`, framework Next.js. Set env vars above.
3. **Webhooks (stubs, HMAC later):** Point Shopify/Stripe to Convex HTTP routes `/webhooks/shopify` and `/webhooks/stripe` on your deployment site URL.

## Repo layout

- `frontend/` — Next.js App Router + `convex/` functions
- `shopify/` — Theme assets for the main shop (unchanged)
- `docs/` — Publishing notes

Removed from the Render stack: FastAPI `backend/`, `render.yaml`, Supabase schema.
