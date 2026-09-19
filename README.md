# Plugga

Swedish product-hacker MVP: upload study notes, extract text, retrieve chunks, generate a quiz. Backend is FastAPI. Frontend is Next.js. Postgres/auth is Supabase. Commerce hooks into Shopify. Deploy target is Render.

Local run does **not** require secrets. Missing Supabase, LLM, or Shopify credentials fall back to memory store, mock questions, and mock catalog/checkout.

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
| `OPENAI_API_KEY` | Quiz generation + embeddings |
| `ANTHROPIC_API_KEY` | Quiz generation |
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
| `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` | Public shop domain |
| `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN` | Storefront API (later checkout UI) |
| `NEXT_PUBLIC_SHOPIFY_API_KEY` | Public Shopify app key |

Without Supabase keys the API stores documents, chunks, quiz sessions, and Shopify links in memory. Without LLM keys it returns mock questions derived from the uploaded text. Without a Shopify Admin token it returns mock products and a draft-order placeholder.

## Apply the SQL in Supabase

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Paste and run [`supabase/schema.sql`](supabase/schema.sql).

The script enables **pgvector**, creates `profiles` (linked to `auth.users`), `documents`, `document_chunks` (hnsw embeddings), `quiz_sessions`, and `shopify_customers`, turns on **RLS** so users only see their own rows, adds `match_document_chunks`, and creates a private `documents` storage bucket.

Then set the backend Supabase env vars (service role on the API, anon key on both API and frontend). Auth is JWT-ready: send `Authorization: Bearer <supabase access token>`. Locally, requests without a token use the `local-dev-user` fallback (or `X-User-Id`).

## API

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/health` | Liveness + which integrations are live vs mock |
| `GET` | `/hello` | Short hello payload |
| `POST` | `/upload-document` | Multipart file → storage + `documents` + chunking |
| `POST` | `/generate-quiz` | `{ document_id, question_count? }` → retrieval + LLM JSON questions |
| `GET` | `/shopify/status` | Connected shop + linked customer |
| `POST` | `/shopify/connect` | OAuth start **or** Admin API token install |
| `POST` | `/shopify/disconnect` | Clears the saved shop install |
| `GET` | `/shopify/oauth/install` | Same as connect without a token (OAuth URL) |
| `GET` | `/shopify/oauth/callback` | Shopify redirect → save token → frontend |
| `POST` | `/shopify/oauth/complete` | Frontend callback exchanges `code` |
| `POST` | `/shopify/customers/link` | App user ↔ Shopify customer |
| `GET` | `/shopify/products` | Live Admin product list when connected |
| `POST` | `/shopify/checkout` | Draft order + `invoice_url` |
| `POST` | `/shopify/webhooks/{topic}` | HMAC webhook stub (`customers/*`, `orders/paid`, uninstall) |

## Shopify notes

Use the **Koppla Shopify** panel on the home page.

**Custom app (fastest locally)**  
In Shopify Admin → Settings → Apps and sales channels → Develop apps: create an app, enable Admin API scopes `read_customers`, `write_customers`, `read_products`, `write_draft_orders`, install it, copy the Admin API access token. Paste shop + token in Plugga.

**OAuth app**  
Set `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET`. Redirect URL in the Shopify app must match `SHOPIFY_OAUTH_REDIRECT_URI` (default `http://127.0.0.1:43123/shopify/callback`). Click **Installera i Shopify**. The token is stored server-side (memory + `.local_shopify_install.json`, and `shopify_installs` when Supabase is on). It is never sent back to the browser.

After connect you can link a customer email and create a draft-order checkout. Webhooks: `https://<api-host>/shopify/webhooks/customers/create` (and update / `orders/paid` / `app/uninstalled`). `app/uninstalled` clears the saved install.

## Render notes

[`render.yaml`](render.yaml) defines two web services: `plugga-api` (Python, `backend/`) and `plugga-web` (Node, `frontend/`).

1. Create a Blueprint from this repo, or two Web Services with those root dirs.
2. Set `FRONTEND_ORIGIN` on the API to the Render frontend URL.
3. Set `NEXT_PUBLIC_API_URL` on the frontend to the Render API URL **before** the frontend build (Next inlines `NEXT_PUBLIC_*`).
4. Add the same Supabase / LLM / Shopify secrets you use locally.
5. After deploy, update Shopify app URLs and webhook endpoints to the Render API host.

## Layout

```
backend/          FastAPI app, routers, services, clients
frontend/         Next.js App Router + Tailwind
supabase/         schema.sql for the SQL Editor
render.yaml       Render Blueprint
```
