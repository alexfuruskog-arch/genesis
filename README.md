# ARZIVE

One brand site: notebooks in the shop, **Study with Arzive** as the logged-in study surface. Not two separate websites.

| Layer | Role |
| --- | --- |
| **Next.js** (`frontend/`) | Brand storefront + Study with Arzive + account |
| **Shopify** | Source of truth for products and checkout (buy links / Storefront API / theme import later) |
| **FastAPI** (`backend/`) | Upload scans, retrieval, quiz & flashcards, Shopify connect hooks |
| **Supabase** | Auth + scanned notes when keys are set; otherwise local memory + MVP email/password |

Nav: **SHOP** · **STUDY WITH ARZIVE** · centered **ARZIVE** · **ACCOUNT** · bag.

Local run does **not** require secrets. Missing Supabase, LLM, or Shopify credentials fall back to memory store, mock study output, and placeholder buy links.

## Run locally

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 48721 --reload
```

- Health: `GET http://127.0.0.1:48721/health`
- Hello: `GET http://127.0.0.1:48721/hello`

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). The UI calls `/backend/*`; Next.js rewrites that to FastAPI (`API_PROXY_TARGET` or `NEXT_PUBLIC_API_URL`, default `http://127.0.0.1:48721`).

## Architecture (why one site)

- **Shop** deep-links to Shopify product pages when `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` is set (handles: `cornell-notebook`, `math-notebook`).
- **Study with Arzive** is `/study` on the same origin — scan uploads, multi-note selection, practice exam or flashcards.
- Later: import the Shopify theme into this Next app or use Hydrogen/Storefront API; still one ARZIVE brand.

## Environment variables

### Backend (`backend/.env`)

| Variable | Purpose |
| --- | --- |
| `FRONTEND_ORIGIN` | CORS origin for the Next app |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Anon key (JWT validation + optional client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Preferred server key for inserts after auth |
| `LLM_PROVIDER` | `auto`, `openai`, `anthropic`, or `mock` |
| `LLM_MODEL` | Optional model override |
| `OPENAI_API_KEY` | Study generation + embeddings |
| `ANTHROPIC_API_KEY` | Study generation |
| `SHOPIFY_STORE_URL` | `your-shop.myshopify.com` |
| `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` | Custom app OAuth |
| `SHOPIFY_ADMIN_API_TOKEN` | Admin API (customers, products, draft orders) |
| `SHOPIFY_WEBHOOK_SECRET` | HMAC verification for `/shopify/webhooks/{topic}` |
| `SHOPIFY_API_VERSION` | Default `2025-01` |

### Frontend (`frontend/.env.local`)

| Variable | Purpose |
| --- | --- |
| `API_PROXY_TARGET` | FastAPI origin for the `/backend` rewrite (server-side) |
| `NEXT_PUBLIC_API_URL` | Fallback API origin used by that rewrite |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` | Public shop domain for buy links |
| `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN` | Storefront API (later checkout UI) |
| `NEXT_PUBLIC_SHOPIFY_API_KEY` | Public Shopify app key |

## Apply the SQL in Supabase

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Paste and run [`supabase/schema.sql`](supabase/schema.sql).

Auth is JWT-ready: send `Authorization: Bearer <supabase access token>`. Without Supabase, use **Account** sign-up (local profiles) or `X-User-Id`.

## API

| Method | Path | What it does |
| --- | --- |
| `GET` | `/health` | Liveness + which integrations are live vs mock |
| `GET` | `/hello` | Short hello payload |
| `POST` | `/auth/signup` | Local email/password account |
| `POST` | `/auth/login` | Local session token |
| `POST` | `/auth/logout` | Clear local session |
| `GET` | `/auth/me` | Current user |
| `POST` | `/upload-document` | Multipart file → storage + chunks |
| `GET` | `/documents` | List scans for the current user |
| `POST` | `/generate-quiz` or `/generate-study` | `{ document_ids[], output_type: quiz\|flashcards\|ovningstenta, question_count? }` |
| `GET` | `/shopify/status` | Connected shop + linked customer |
| `POST` | `/shopify/connect` | OAuth start **or** Admin API token install |
| `POST` | `/shopify/disconnect` | Clears the saved shop install |
| `GET` | `/shopify/oauth/install` | Same as connect without a token (OAuth URL) |
| `GET` | `/shopify/oauth/callback` | Shopify redirect → save token → frontend |
| `POST` | `/shopify/oauth/complete` | Frontend callback exchanges `code` |
| `POST` | `/shopify/customers/link` | App user ↔ Shopify customer |
| `GET` | `/shopify/products` | Live Admin product list when connected |
| `POST` | `/shopify/checkout` | Draft order + `invoice_url` |
| `POST` | `/shopify/webhooks/{topic}` | HMAC webhook stub |

## Pages

| Path | Purpose |
| --- | --- |
| `/` | Brand home — hero + Cornell / Math |
| `/shop` | Two notebooks, Shopify buy links |
| `/study` | Upload, multi-select, practice exam / flashcards |
| `/account` | Sign in / up / out + optional Shopify merchant connect |
| `/story` | Short brand story |

## Render notes

[`render.yaml`](render.yaml) defines two web services. Prefer renaming services to `arzive-api` / `arzive-web` when you create the real repo.

1. Create a Blueprint from this repo, or two Web Services with those root dirs.
2. Set `FRONTEND_ORIGIN` on the API to the Render frontend URL.
3. Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` on the frontend **before** build.
4. Add the same Supabase / LLM / Shopify secrets you use locally.

## Layout

```
backend/          FastAPI app, routers, services, clients
frontend/         Next.js App Router + Tailwind (ARZIVE brand)
supabase/         schema.sql for the SQL Editor
render.yaml       Render Blueprint
```
