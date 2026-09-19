# Publish ARZIVE tomorrow morning

Half-asleep checklist. Do these in order. Shop first, Study second.

---

## A) Shopify theme (about 10 minutes)

1. Download **`arzive-theme.zip`** from this same docs folder  
   (or rebuild: `./shopify/pack-theme.sh` → `shopify/arzive-theme.zip`).
2. Shopify Admin → **Online Store → Themes**.
3. **Add theme → Upload zip** → choose `arzive-theme.zip`.
4. On the uploaded theme → **Publish**.
5. **Customize** → Theme settings:
   - **Study with Arzive URL** → your live Study URL ending in `/study`  
     (example: `https://arzive-web.onrender.com/study`).
6. Create a page **Our story** with handle `our-story` (or leave the theme default).
7. **Fix product photos** (critical — kill glued collages):
   - Product **Math** (`arzive-math-notebook`) → remove collage media → upload **one** Green Math cover (`notebook-green.jpg`).
   - Cornell product → **one** Cream Cornell cover (`notebook-cream.jpg`).
8. Hard-refresh the storefront. You should see: cream announce bar, centered **ARZIVE**, split Cream / Math hero, Pricing in the header (points at Study `/pricing`).

Full theme notes: [`THEME.md`](./THEME.md).

---

## B) Study app (Next + API)

### If you already have a GitHub mirror

1. Push this branch (or `main`) to GitHub.
2. Render → **New → Blueprint** → select the GitHub repo → apply `render.yaml`.
3. Services appear: **arzive-api** + **arzive-web**.
4. Paste env (section C) → **Clear build cache & deploy** on the web service.
5. Open `https://<arzive-web>.onrender.com/study` and `/pricing`.
6. Point the Shopify theme Study URL at that `/study` (step A5).

### If the repo is still Origin-only

Render cannot clone Cursor Origin. Mirror once:

```bash
git clone <this-repo>
cd <repo>
git remote add github https://github.com/YOUR_ORG/YOUR_REPO.git
git push -u github HEAD:main
```

Then Blueprint from GitHub as above. Longer notes: [`RENDER.md`](./RENDER.md).

### Local smoke (tonight)

```bash
# API
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 48721

# Web
cd frontend && npm run dev
# → http://127.0.0.1:43123  (Study / Pricing / Account)
```

Theme HTML preview (optional): `cd shopify && python3 -m http.server 43145` → `/preview/`.

---

## C) Env to paste (Render)

Cross-service URLs from `render.yaml` are usually wired automatically. Still set:

### arzive-api

| Key | Notes |
| --- | --- |
| `OPENAI_API_KEY` **or** `ANTHROPIC_API_KEY` | Study generation |
| `LLM_PROVIDER` | `auto` is fine |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Auth + cloud scans (optional for first publish — local fallback works) |
| `SHOPIFY_STORE_URL` | e.g. `sexb4g-xw.myshopify.com` |

### arzive-web

| Key | Notes |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Public API URL (Blueprint may set this) |
| `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` | Same shop domain for buy links |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Match API if using Supabase |

Without LLM keys, Study still loads; generation returns a clear error. Without Supabase, Account + scans use the local fallback.

---

## D) Pricing (product, not footnotes)

Live at `/pricing` on the Study app:

| Plan | Price | Limit |
| --- | --- | --- |
| **Free** | $0 | **3 chats / week**, **5 scans** — hard gates in Study |
| **Standard** | **$12 / month** | Unlimited Study |
| **Annual** | **$96 / year** | Standard, billed yearly (~$8/mo) |
| **Scholar** | **$29 / month** | Unlimited + notebook credit |

Account `?plan=standard|annual|scholar` attaches the plan for this browser (billing can replace later).

---

## E) Morning sanity check

- [ ] Shopify theme published; product images are single covers (no collage).
- [ ] Header: Shop · Study with Arzive · **ARZIVE** · Pricing · Our story · Account.
- [ ] `/study` opens, Free meter visible, generate blocked after 3 chats.
- [ ] `/pricing` shows four plans, Standard $12 featured.
- [ ] Theme Study URL hits the live `/study`.

Brand only ships **Cream Cornell** + **Green Math**. No other notebook SKUs in the flagship story.
