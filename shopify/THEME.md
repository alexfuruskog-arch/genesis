# Ladda upp ARZIVE-temat till Shopify

Temat ligger i `shopify/theme/`. Det är ett **Online Store 2.0**-tema (JSON-mallar + sektioner) som speglar Next.js-designen: mörkgrön hero, cream-typografi, ARZIVE-wordmark, SHOP + STUDY WITH ARZIVE, Cream Cornell + Green Math.

Study-appen (konto, skanning, AI) stannar i Next.js. Temat länkar dit via **Theme settings → Study with Arzive URL**.

## 1) Skapa zip

Från repo-roten:

```bash
./shopify/pack-theme.sh
```

Filen skapas som `shopify/arzive-theme.zip` (innehållet är `layout/`, `templates/`, `sections/`, … i zip-roten — korrekt för Shopify).

## 2) Ladda upp i Admin

1. Öppna **Shopify Admin**.
2. Gå till **Online Store → Themes**.
3. Klicka **Add theme** (eller **Lägg till tema**).
4. Välj **Upload zip file** / **Ladda upp zip-fil**.
5. Välj `shopify/arzive-theme.zip`.
6. Vänta tills uppladdningen är klar.

## 3) Koppla Study-URL

1. På det nya temat: **Customize** / **Anpassa**.
2. Öppna **Theme settings** (kugghjulet) → **Brand & Study**.
3. Sätt **Study with Arzive URL** till din Next.js-app, t.ex.  
   `https://DIN-RENDER-URL/study` eller `http://127.0.0.1:43123/study` (lokalt).
4. Sätt **Account URL** till `…/account` om du vill (annars ersätts `/study` → `/account` automatiskt i headern om du bara sätter Study-URL).
5. Under **Homepage products**: välj dina produkter **Cream Cornell Notebook** (`cornell-notebook`) och **Green Math Notebook** (`math-notebook`) om de inte plockas upp via handle.

## 4) Publicera

1. I **Online Store → Themes**, hitta **ARZIVE**.
2. Klicka **… → Publish** / **Publicera**.
3. Bekräfta. Butikens startsida är nu ARZIVE-designen.

## 5) Snabbkoll efter publicering

- Startsida: mörkgrön hero + Cornell/Math-flikar  
- `/collections/all` eller Shop: två notebook-kort  
- `/products/cornell-notebook` och `/products/math-notebook`: produkt + add to cart  
- **Study with Arzive** i menyn: öppnar Next.js (inte en Shopify-sida)

## Tips

- Produktbilder: temat har fallback-bilder i `assets/`. Lägg gärna samma bilder på produkterna i Admin så produkt-sidan använder Shopify CDN.
- Om handles skiljer dig från `cornell-notebook` / `math-notebook`: välj produkterna manuellt i temat (Customize → Product tabs / Theme settings).
- Next.js (`frontend/`) behålls för Study. Sätt gärna `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` dit om du fortfarande vill ha köplänkar från Study-appen tillbaka till Shopify.
