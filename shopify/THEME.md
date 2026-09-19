# Upload the ARZIVE Shopify theme

Do this when you wake up. Zip is already packed: **`arzive-theme.zip`** in this docs folder (and `shopify/arzive-theme.zip` in the repo).

**Store:** `sexb4g-xw.myshopify.com`  
**Products:** Cream Cornell + Green Math only (`arzive-math-notebook`). One editorial photo each — never a glued collage.

**Nav after publish:** Shop · Study with Arzive · **ARZIVE** · Pricing · Our story · Account · bag

---

## 1) Upload & publish

1. Shopify Admin → **Online Store → Themes**.
2. **Add theme → Upload zip file** → pick `arzive-theme.zip`.
3. Wait for upload → **Publish**.
4. Open the live storefront in a private window. You should see the cream announce bar and centered **ARZIVE**.

Rebuild from the repo anytime:

```bash
./shopify/pack-theme.sh
# → shopify/arzive-theme.zip
```

---

## 2) Wire Study (required)

1. Theme editor → **Theme settings**.
2. Set **Study with Arzive URL** to your live Next app, ending in `/study`  
   Example: `https://YOUR-WEB.onrender.com/study`
3. Pricing in the theme header is derived as that URL with `/study` → `/pricing`.
4. Create a page titled **Our story** with handle `our-story` (optional but recommended).

---

## 3) Fix product media (do not skip)

Admin still may have collage images. Replace them:

| Product | Handle | Upload this |
| --- | --- | --- |
| Cream Cornell | (your Cornell handle) | Single cream cover — `notebook-cream.jpg` |
| Math Study System | `arzive-math-notebook` | Single green cover — `notebook-green.jpg` |

Delete every collage / multi-tile image from the product gallery. One hero photo per product.

Files live in the theme zip under `assets/`, and in the Next app under `frontend/public/products/`.

---

## 4) Quick visual check

- Split hero: Cream lifestyle left, Math product right.
- Trust bar under the hero (forest green).
- Philosophy → three notebooks (Cornell, Math, bundle) — no collage tiles.
- Interiors carousel uses real page photos.
- Cart and collection templates match the same forest/cream system.

Study plans (on the Next app, not Liquid): Free · Standard $12/mo · Annual · Scholar — see **PUBLISH.md**.
