# Deployera ARZIVE till Render

Blueprint: `render.yaml` → **arzive-api** (FastAPI) + **arzive-web** (Next.js Study).

## Viktigt: Origin ≠ GitHub

Repot `alexander-furuskog/genesis` ligger på **Cursor Origin**. Render Blueprint stödjer bara **GitHub / GitLab / Bitbucket** — inte Origin.

Kortaste vägen till live Render-URL:

### A) GitHub-mirror (rekommenderas)

1. Skapa ett GitHub-repo (t.ex. `alexander-furuskog/arzive` eller `genesis`).
2. Spegla Origin-branchen dit:

```bash
git clone https://origin.cursor.com/alexander-furuskog/genesis.git
cd genesis
git checkout cursor/ai-study-mvp-ea0d
git remote add github https://github.com/DIGT-GITHUB-OWNER/DIGT-REPO.git
git push -u github cursor/ai-study-mvp-ea0d
git push github cursor/ai-study-mvp-ea0d:main   # valfritt
```

3. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint** → koppla **GitHub**-repot → Apply `render.yaml`.
4. URL:er blir typ `https://arzive-web.onrender.com` och `https://arzive-api.onrender.com`.

### B) Render API-nyckel till agenten

Klistra in `RENDER_API_KEY` i Cursor + ge agenten ett **GitHub**-repo den kan pusha till. Då kan agenten skapa Blueprint.

## Env att klistra in i Render (efter Blueprint)

Cross-service-URL:er (`FRONTEND_ORIGIN`, `NEXT_PUBLIC_API_URL`, `API_PROXY_TARGET`) sätts automatiskt.

### arzive-api

| Key | Vad |
| --- | --- |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Auth + scans |
| `OPENAI_API_KEY` eller `ANTHROPIC_API_KEY` | LLM |
| `LLM_PROVIDER` | redan `auto` |
| `SHOPIFY_STORE_URL` | `din-shop.myshopify.com` |
| `SHOPIFY_*` tokens | connect/webhooks (valfritt) |

### arzive-web

| Key | Vad |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | samma som API |
| `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` | shop-domain för buy links |

Efter web-env: **Clear build cache & deploy**.

Shopify theme → **Study with Arzive URL** = `https://<arzive-web>.onrender.com/study`

## Status i Origin

- Repo: https://cursor.com/codebase/alexander-furuskog/genesis  
- Draft PR: https://cursor.com/codebase/alexander-furuskog/genesis/pull/1  
- Branch: `cursor/ai-study-mvp-ea0d` (inkl. `backend/`, `frontend/`, `shopify/`, `render.yaml`)
