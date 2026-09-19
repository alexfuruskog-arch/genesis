# Ladda upp ARZIVE-temat till Shopify

Temat: `shopify/theme/` → zip `shopify/arzive-theme.zip`.  
Butik: `sexb4g-xw.myshopify.com`. Live math-handle: **`arzive-math-notebook`**.

Design: mörkgrön hero, cream typografi, ARZIVE-wordmark, **SHOP + STUDY WITH ARZIVE**, **en** stark produktbild per notebook (inga limmade diptyker).

## 1) Skapa zip

```bash
./shopify/pack-theme.sh
```

## 2) Ladda upp / byt tema

1. Shopify Admin → **Online Store → Themes**
2. **Add theme → Upload zip file**
3. Välj `arzive-theme.zip`
4. **… → Publish**

Om du redan har ARZIVE publicerat: ladda upp den nya zip:en och publicera den (eller Replace theme).

## 3) Theme settings

**Customize → Theme settings (kugghjul):**

1. **Study with Arzive URL** → din Next.js `/study`
2. **Homepage products** → välj Cream Cornell + **Green Math** (`arzive-math-notebook`)

## 4) Viktigt — byt ut limmade produktbilder i Admin

Temat visar nu **tema-assets** (`notebook-cream.jpg` / `notebook-green.jpg`) som huvudbild, så butiken ser bra ut även om Admin har en collage.

Byt ändå ut den dåliga Admin-bilden så produktgalleriet/CDN inte visar limningen:

1. Admin → **Products**
2. Öppna **Math Notebook** (`arzive-math-notebook`)
3. Under **Media**: ta bort bilden som är **grön pärm + cream spiral limmade i samma rektangel**
4. Ladda upp en enda cover: använd `shopify/theme/assets/notebook-green.jpg` (eller motsvarande studio-foto)
5. Gör samma för Cornell-produkten om den har en limmad collage → ersätt med `notebook-cream.jpg`

## 5) Snabbkoll

- Startsida: en cover per flik (Cornell / Math) — inte två bilder sida vid sida  
- `/collections/all`: två kort, **en** foto vardera  
- `/products/arzive-math-notebook`: en hero-cover  
- **Study with Arzive** i nav → Next.js
