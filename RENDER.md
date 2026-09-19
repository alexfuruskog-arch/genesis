# Deployera ARZIVE till Render

Blueprint: `render.yaml` (två tjänster: **arzive-api** + **arzive-web**).

## Blocker just nu

Det finns **inget GitHub-repo ännu** (bara Cursor Origin-temp). Render kan inte deploya därifrån.

1. Klicka **Create repo** i Cursor agent-vyn.
2. Svara i chatten när repot finns — då kan agenten pusha och (med `RENDER_API_KEY`) skapa Blueprint.

Utan Create repo: gör stegen nedan själv efter att du skapat GitHub-repot.

## 1) Skapa Blueprint i Render

1. Öppna [https://dashboard.render.com](https://dashboard.render.com) → logga in.
2. **New** → **Blueprint**.
3. Koppla ditt **GitHub**-konto och välj ARZIVE-repot.
4. Branch: `cursor/ai-study-mvp-ea0d` (eller `main` när den är mergad).
5. Render läser `render.yaml` → **Apply**.
6. Vänta tills **arzive-api** och **arzive-web** är Live.

URL:er blir typ:

- Frontend (Study): `https://arzive-web.onrender.com`
- API: `https://arzive-api.onrender.com`

(exakta hostnames står på varje service → **Settings** → URL)

## 2) Env-variabler du måste klistra in

Blueprint sätter automatiskt API↔frontend-URL:er (`FRONTEND_ORIGIN`, `NEXT_PUBLIC_API_URL`, `API_PROXY_TARGET`). Resten paste:ar du i Dashboard → service → **Environment**.

### arzive-api (valfritt men rekommenderat)

| Key | Vad |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server) |
| `OPENAI_API_KEY` eller `ANTHROPIC_API_KEY` | LLM för quiz/flashcards |
| `LLM_PROVIDER` | redan `auto` — eller `openai` / `anthropic` / `mock` |
| `SHOPIFY_STORE_URL` | `din-shop.myshopify.com` |
| `SHOPIFY_ADMIN_API_TOKEN` | Admin API token (om du använder connect) |
| `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` | OAuth custom app |
| `SHOPIFY_WEBHOOK_SECRET` | webhook HMAC |

Utan dessa nycklar startar API:t ändå (memory store + mock LLM).

### arzive-web

| Key | Vad |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | samma som backend |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | samma anon key |
| `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` | t.ex. `din-shop.myshopify.com` |
| `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN` | Storefront API (valfritt) |
| `NEXT_PUBLIC_SHOPIFY_API_KEY` | public app key (valfritt) |

Handles `cornell-notebook` / `math-notebook` är redan satta i Blueprint.

**Efter env-ändringar på web:** Manual Deploy → **Clear build cache & deploy** (NEXT_PUBLIC_* bakas in vid build).

## 3) Shopify theme → Study-URL

När frontend är live: Shopify Admin → tema **Customize** → Theme settings → **Study with Arzive URL** =

`https://arzive-web.onrender.com/study`

(Account: `…/account`)

## 4) Snabbkoll

- `https://arzive-api.onrender.com/health`
- `https://arzive-web.onrender.com/study`
- `https://arzive-web.onrender.com/shop`
