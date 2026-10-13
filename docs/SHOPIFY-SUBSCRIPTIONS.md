# Shopify-prenumerationer → Study (en väg)

Alexander: inga Terminal-kommandon. Bara klick i Shopify Admin och Convex.

**Butik:** arzive.org (`sexb4g-xw.myshopify.com`)  
**Study:** https://arzive.vercel.app/study  
**API:** Convex HTTP Actions (`https://DIN-DEPLOYMENT.convex.site`)  

Produkterna finns redan: `membership-standard` ($12), `membership-annual` ($96), `membership-scholar` ($29). Skapa inga nya SKU:er.

Målet: **Buy Standard** på Pricing → kassa med **månadsdrag på kort** (Shopify Payments) → samma e-post i Study visar **Standard**.

Inte Autogiro. Inte Bankgirot. Inte Recharge.

---

## Steg 1 — Shopify Payments (kort)

1. Logga in på Shopify Admin för ARZIVE.
2. **Inställningar** (kugghjul) → **Betalningar**.
3. Shopify Payments ska vara **på**. Om du ombeds slutföra uppgifterna, gör det.
4. Klart när du ser att kort (Visa/Mastercard) är aktiva.

Prenumerationer kräver Shopify Payments. Swish/Autogiro kan inte dra varje månad.

---

## Steg 2 — Installera appen Shopify Subscriptions

1. Öppna [Shopify Subscriptions i App Store](https://apps.shopify.com/shopify-subscriptions) (Shopifys egen app, gratis).
2. Klicka **Add app** / **Lägg till app** → **Installera**.
3. Godkänn behörigheterna.

Klart när appen syns under **Appar**.

---

## Steg 3 — Tre säljplaner på de tre medlemsprodukterna

Gör detta **en gång per produkt**. Samma klick varje gång.

### Standard — varje månad, $12

1. **Appar** → **Shopify Subscriptions**.
2. **Plans** / **Prenumerationsplaner** → **Create plan** / **Skapa plan** (eller **+ Plan**).
3. Titel (kunden ser den): `Standard monthly`.
4. Erbjud **inte** rabatt.
5. **Delivery frequency** / **Leveransintervall:** `1` + **Monthly** / **månad**.
6. Under produkter: lägg till **Study Standard Membership** (`membership-standard`).
7. **Save** / **Spara**.

Öppna sedan produkten:

1. **Produkter** → **Study Standard Membership**.
2. Avsnittet **Purchase options** / **Köpalternativ**.
3. Kryssa i **Only sell this product as a subscription** / **Sälj bara som prenumeration**.
4. **Spara**.

### Annual — en gång om året, $96

Samma som ovan, men:

- Titel: `Annual yearly`
- Intervall: `1` + **Yearly** / **år**
- Produkt: **Study Annual Membership** (`membership-annual`)
- Kryssa i **sälj bara som prenumeration** på den produkten

### Scholar — varje månad, $29

- Titel: `Scholar monthly`
- Intervall: `1` + **Monthly** / **månad**
- Produkt: **Study Scholar Membership** (`membership-scholar`)
- Kryssa i **sälj bara som prenumeration**

Klart när varje medlemsprodukt visar en prenumeration under **Köpalternativ**.

---

## Steg 4 — Webhook (Shopify säger till Study när någon betalat)

1. **Inställningar** → **Aviseringar**.
2. Scrolla till **Webhooks** längst ner.
3. **Skapa webhook**.
4. Fyll i **exakt** så här:

| Fält | Värde |
| --- | --- |
| Händelse | **Order payment** / **Orderbetalning** |
| Format | **JSON** |
| URL | `https://DIN-DEPLOYMENT.convex.site/webhooks/shopify` (Convex → Settings → URL & Deploy Key → **HTTP Actions URL**, lägg till `/webhooks/shopify`) |
| API-version | **2025-01** (eller den som står närmast) |

5. **Spara webhook**.
6. Skapa **ytterligare två** med samma URL och JSON:

| Händelse | Varför |
| --- | --- |
| **Order cancelled** / **Order avbruten** | Avbrutet köp → Study tillbaka till Free |
| **Refund create** / **Återbetalning skapad** | Återbetalning → Free |

7. På samma Webhooks-sida finns **Signing secret** / **Signeringshemlighet**.  
   Klicka **Visa** och **kopiera** den. Du klistrar in den i Convex i nästa steg.

En URL räcker. API:t läser headern `X-Shopify-Topic` och mappar SKU:erna `ARZ-MEM-STANDARD` / `ANNUAL` / `SCHOLAR` till plan.

---

## Steg 5 — Convex (miljövariabel)

1. Öppna [dashboard.convex.dev](https://dashboard.convex.dev) och välj **production**-deploymenten.
2. **Settings** → **Environment Variables** → **Add**:

| Key (exakt namn) | Value |
| --- | --- |
| `SHOPIFY_WEBHOOK_SECRET` | signeringshemligheten från steg 4 |

3. Spara. Ingen omstart behövs.

**Viktigt:** utan `SHOPIFY_WEBHOOK_SECRET` avvisar Study alla webhooks (svarar 401). Det är med flit — annars kan vem som helst skicka ett falskt "betalt"-anrop och låsa upp Pro gratis.

Använder du Stripe också: lägg till `STRIPE_WEBHOOK_SECRET` (börjar med `whsec_`) och peka Stripe-webhooken till `https://DIN-DEPLOYMENT.convex.site/webhooks/stripe`.

---

## Steg 6 — Ladda upp temat igen (Pricing-knapparna)

Buy på Pricing måste skicka med prenumerationen. Den här zippen gör det.

1. Ladda ner **`arzive-theme.zip`** från samma docs-mapp som den här sidan.
2. Shopify Admin → **Online Store** / **Webbutik** → **Themes** / **Teman**.
3. **Add theme** → **Upload zip file** → välj zippen.
4. **Publish** / **Publicera** på den uppladdade versionen.

Utan den här zippen går Buy till kassan som **engångsköp**, även om prenumerationen finns på produkten.

---

## Vad “lyckat” ser ut

1. Öppna butikens **Pricing**-sida (Shopify, inte Study).
2. Klicka **Buy Standard · $12**.
3. Kassan ska visa **månadsvis** / subscription (inte bara “12 en gång”).
4. Betala med testkort (om butiken är i testläge) eller ett riktigt kort.
5. Använd **samma e-post** som du vill ha i Study.
6. Öppna https://arzive.vercel.app/account  
   - Har du redan Study: logga in med den e-posten → **Plan · Plus**.  
   - Har du inte Study: skapa konto med **samma e-post** → Standard låses upp direkt.
7. Öppna https://arzive.vercel.app/study — Free-mätaren är borta och det står **Plan · Plus · unlimited uploads**.

Avbryt i Shopify (kundportal eller Admin → prenumerationer / order): Study går tillbaka till **Free** (genast vid avbruten order/återbetalning, annars när perioden löper ut).

---

## Om kassan fortfarande är engångsköp

- Steg 3: “sälj bara som prenumeration” är inte ikryssat.
- Steg 6: gamla temat är fortfarande publicerat (Buy saknar `selling_plan`).
- Du klickade produktens gamla “Add to cart” istället för **Buy** på Pricing.

## Om Study fortfarande visar Free efter betald order

- E-post i Shopify-kassan ≠ e-post i Study. De måste vara identiska.
- `SHOPIFY_WEBHOOK_SECRET` saknas eller är fel i **Convex** (då svarar webhooken 401).
- Webhook-URL:n pekar fortfarande på gamla `arzive-api.onrender.com` i stället för `https://DIN-DEPLOYMENT.convex.site/webhooks/shopify`.
- Convex-funktionerna är inte deployade: kör `npx convex deploy` i `frontend/`.
- I Shopify → Aviseringar → Webhooks: skicka en testnotis om knappen finns. Svaret ska vara 200.

Ingen GitHub, ingen Terminal, ingen Recharge.
