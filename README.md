# ARZIVE

One brand site: notebooks in the shop, **Study with Arzive** as the logged-in study surface. Not two separate websites.

| Layer | Role |
| --- | --- |
| **Next.js** (`frontend/`) | Brand storefront + Study with Arzive + account |
| **Shopify** | Source of truth for products and checkout (buy links / Storefront API / theme import later) |
| **FastAPI** (`backend/`) | Upload scans and lecture files, retrieval, quiz & flashcards, Shopify connect hooks |
| **Supabase** | Auth + library files when keys are set; otherwise local memory + MVP email/password |

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

- **Shop** deep-links to Shopify product pages when `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` is set (handles: `arzive-cornell-notebook`, `arzive-math-notebook` — see [`shopify/products.md`](shopify/products.md)).
- **Study with Arzive** is `/study` on the same origin — camera scans **and** lecture file uploads (PDF, images, Word, PowerPoint) under your account, multi-note selection, practice exam or flashcards. Files land in Supabase Storage with RLS when configured; otherwise a local-disk fallback.
- **Pricing** (`/pricing`): Free (3 chats/week, 5 library items — notebook scans or lecture files), Standard **$12/mo**, Annual **$96/yr**, Scholar **$29/mo**. Paid CTAs check out on Shopify. Free limits are enforced in the Study UI **and** the API.
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
| `LOCAL_UPLOAD_DIR` | Optional. Directory for the local file fallback when Supabase Storage is not configured (default `.local_uploads` under `backend/`). On Render this disk is ephemeral — set the Supabase keys for a durable library. |

### Frontend (`frontend/.env.local`)

| Variable | Purpose |
| --- | --- |
| `API_PROXY_TARGET` | FastAPI origin for the `/backend` rewrite (server-side) |
| `NEXT_PUBLIC_API_URL` | Fallback API origin used by that rewrite |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` | Public shop domain for buy links |
| `NEXT_PUBLIC_SHOPIFY_CORNELL_HANDLE` | Optional override (default `arzive-cornell-notebook`) |
| `NEXT_PUBLIC_SHOPIFY_MATH_HANDLE` | Optional override (default `arzive-math-notebook`) |
| `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN` | Storefront API (later checkout UI) |
| `NEXT_PUBLIC_SHOPIFY_API_KEY` | Public Shopify app key |

## Apply the SQL in Supabase

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Paste and run [`supabase/schema.sql`](supabase/schema.sql).

Auth is JWT-ready: send `Authorization: Bearer <supabase access token>`. Without Supabase, use **Account** sign-up (local profiles). Library files are scoped by `user_id` and stored at `{user_id}/…` in the private `documents` bucket (RLS). Without Supabase keys the API keeps a local disk + memory fallback so Study still works. Re-run [`supabase/schema.sql`](supabase/schema.sql) to add `source_kind` (`scan` or `lecture`) if the project already existed.

## Shopify Online Store theme

Uploadable OS 2.0 theme (ARZIVE homepage + shop design):

- Theme source: [`shopify/theme/`](shopify/theme/)
- Upload guide (Swedish): [`shopify/THEME.md`](shopify/THEME.md)
- Zip: run `./shopify/pack-theme.sh` → `shopify/arzive-theme.zip`
- Admin: **Online Store → Themes → Add theme → Upload zip file**

Study with Arzive stays on Next.js; set **Study with Arzive URL** in theme settings after upload.

## Shopify product paste

Paste-ready titles, descriptions, handles, and CSV for **Cornell Notebook** and **Math Notebook**:

- [`shopify/products.md`](shopify/products.md) — copy into Shopify Admin
- [`shopify/products.csv`](shopify/products.csv) — Products → Import

Then set `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` so Shop buy buttons hit those products.

## API

| Method | Path | What it does |
| --- | --- |
| `GET` | `/health` | Liveness + which integrations are live vs mock |
| `GET` | `/hello` | Short hello payload |
| `POST` | `/auth/signup` | Local email/password account |
| `POST` | `/auth/login` | Local session token |
| `POST` | `/auth/logout` | Clear local session |
| `GET` | `/auth/me` | Current user |
| `POST` | `/upload-document` | Multipart file (scan or lecture) → storage + chunks. Form: `source_kind=scan\|lecture`, optional `notebook_model` |
| `GET` | `/documents` | List library items for the current user (scans + lecture files) |
| `GET` | `/documents/{id}/file` | Original file bytes (inline preview / download) |
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
| `GET` | `/membership` or `/membership/me` | Current Study plan, chat/scan usage |
| `POST` | `/shopify/webhooks` or `/shopify/webhooks/{topic}` | HMAC-verified membership webhooks (`orders/paid` → plan) |

## Pages

| Path | Purpose |
| --- | --- |
| `/` | Brand home — hero + Cornell / Math |
| `/shop` | Two notebooks, Shopify buy links |
| `/study` | Scan a notebook page or upload a lecture PDF/docx/pptx, then practice exam / flashcards |
| `/account` | Sign in / up / out + optional Shopify merchant connect |
| `/story` | Short brand story |

## Render deploy

Blueprint: [`render.yaml`](render.yaml) → services **arzive-api** (FastAPI) + **arzive-web** (Next.js Study).

Full Swedish steps + env paste list: [`RENDER.md`](RENDER.md). Shopify memberships (clicks only): [`docs/SHOPIFY-SUBSCRIPTIONS.md`](docs/SHOPIFY-SUBSCRIPTIONS.md).

1. **Create repo** in Cursor (GitHub) — required; Render cannot use the Origin temp remote.
2. Render Dashboard → **New → Blueprint** → connect the GitHub repo → Apply.
3. Cross-service URLs are wired automatically (`FRONTEND_ORIGIN`, `NEXT_PUBLIC_API_URL`, `API_PROXY_TARGET`).
4. Paste Supabase / Shopify / LLM secrets in each service’s Environment (see RENDER.md).
5. After web env changes: **Clear build cache & deploy** so `NEXT_PUBLIC_*` rebuild.
6. Point the Shopify theme’s **Study with Arzive URL** at `https://<arzive-web>.onrender.com/study`.

## Layout

```
backend/          FastAPI app, routers, services, clients
frontend/         Next.js Study app + brand reference UI
shopify/theme/    Online Store 2.0 theme (upload zip to Shopify)
shopify/          products.csv/md + THEME.md + pack-theme.sh
supabase/         schema.sql for the SQL Editor
render.yaml       Render Blueprint
```
