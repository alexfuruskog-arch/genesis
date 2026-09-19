# Ladda upp ARZIVE-temat (mock-layout v2)

Temat följer Alexanders design-mocks: split hero, philosophy, 3-up products, interiors-karusell, sustainability, Choose Arzive, newsletter, cart.

**Produkter:** Cream Cornell + Green Math (`arzive-math-notebook`).  
**En** editorial-bild per produkt — inga limmade diptyker.

Butik: `sexb4g-xw.myshopify.com`

## 1) Zip

```bash
./shopify/pack-theme.sh
```

→ `shopify/arzive-theme.zip` (även i Cursor Context docs)

## 2) Ladda upp

1. Admin → **Online Store → Themes**
2. **Add theme → Upload zip**
3. Välj `arzive-theme.zip`
4. **Publish**

## 3) Settings

Customize → Theme settings:

- **Study with Arzive URL** → din Next.js `/study`
- **Homepage products** → Cornell + Math (`arzive-math-notebook`)
- Skapa sidan **Our story** (handle `our-story`) så mallen `page.our-story` används

## 4) Byt limmade Admin-bilder

Temat använder `notebook-cream.jpg` / `notebook-green.jpg` som hero — men byt ändå i Admin:

1. **Products → Math Notebook** (`arzive-math-notebook`)
2. **Media** → ta bort collagen (grön pärm + cream spiral limmade)
3. Ladda upp `shopify/theme/assets/notebook-green.jpg`
4. Samma för Cornell → `notebook-cream.jpg`

## 5) Kolla

- Startsida: split hero (lifestyle + cover), 3 kort, karusell  
- `/collections/all`: två singel-foton  
- `/products/arzive-math-notebook`: en hero-cover  
- `/cart`: empty + upsell enligt mock
