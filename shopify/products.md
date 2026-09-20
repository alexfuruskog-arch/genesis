# ARZIVE Shopify products (paste / import)

Use these two products in Shopify Admin. Handles match the Next.js Shop buy links when `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` is set.

Default product URLs:

- `https://YOUR-STORE.myshopify.com/products/arzive-cornell-notebook`
- `https://YOUR-STORE.myshopify.com/products/arzive-math-notebook`

If your Admin handles differ, set:

- `NEXT_PUBLIC_SHOPIFY_CORNELL_HANDLE`
- `NEXT_PUBLIC_SHOPIFY_MATH_HANDLE`

---

## 1) Cornell Notebook

| Field | Value |
| --- | --- |
| **Title** | Cornell Notebook |
| **Handle / URL slug** | `arzive-cornell-notebook` |
| **Vendor** | ARZIVE |
| **Product type** | Notebook |
| **Tags** | cornell, cream, study, notebook |
| **Status** | Active |

**Description (paste into Shopify):**

```html
<p>The Cornell Notebook — structured thinking on recycled cream paper.</p>
<p>Each page follows the classic Cornell system: <strong>Cues</strong>, <strong>Main Notes</strong>, and <strong>Summary</strong>. Spiral-bound for lectures and revision.</p>
<p>After you write, open <em>Study with Arzive</em>, scan your pages to your account, and turn selected notes into a practice exam or flashcards.</p>
<ul>
  <li>Cover: cream</li>
  <li>Layout: Cornell (Cues · Main Notes · Summary)</li>
  <li>Binding: black spiral</li>
</ul>
```

**Suggested variant:** Default Title / One size · set your price in Admin.

---

## 2) Math Notebook

| Field | Value |
| --- | --- |
| **Title** | Math Notebook |
| **Handle / URL slug** | `arzive-math-notebook` |
| **Vendor** | ARZIVE |
| **Product type** | Notebook |
| **Tags** | math, green, study, notebook |
| **Status** | Active |

**Description (paste into Shopify):**

```html
<p>The Math Notebook — mathematical clarity in forest green.</p>
<p>Pages are built for problem sets: a large <strong>Example and Practice Questions</strong> grid, plus <strong>Formulas</strong> and <strong>Explanations</strong> beside.</p>
<p>Scan finished pages into Study with Arzive under your customer account to generate practice exams or flashcards from the notes you choose.</p>
<ul>
  <li>Cover: forest green</li>
  <li>Layout: Math (Practice · Formulas · Explanations)</li>
  <li>Binding: black spiral</li>
</ul>
```

**Suggested variant:** Default Title / One size · set your price in Admin.

---

## CSV import

Import [`products.csv`](products.csv) via Shopify Admin → Products → Import (adjust price/SKU as needed). Or create products manually with the titles/handles above if they already exist — just align the handles.

## Wire the ARZIVE site

In `frontend/.env.local`:

```bash
NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
# optional overrides if Admin handles differ:
# NEXT_PUBLIC_SHOPIFY_CORNELL_HANDLE=arzive-cornell-notebook
# NEXT_PUBLIC_SHOPIFY_MATH_HANDLE=arzive-math-notebook
```

Shop buttons then open `/products/<handle>` on that domain.

---

## Membership products (Study pricing checkout)

Create these three products so the **Pricing** page (`page.pricing`) Buy buttons go to Shopify checkout. Handles must match exactly (or assign products in the Pricing section settings).

### Standard — $12/month

| Field | Value |
| --- | --- |
| **Title** | Study Standard Membership |
| **Handle** | `membership-standard` |
| **Price** | 12.00 USD |
| **Product type** | Membership |
| **Tags** | membership, study, standard |
| **Selling plan** | Enable native Shopify Subscriptions (monthly). See `docs/SHOPIFY-SUBSCRIPTIONS.md`. |

### Annual — $96/year

| Field | Value |
| --- | --- |
| **Title** | Study Annual Membership |
| **Handle** | `membership-annual` |
| **Price** | 96.00 USD |
| **Product type** | Membership |
| **Tags** | membership, study, annual |

### Scholar — $29/month

| Field | Value |
| --- | --- |
| **Title** | Study Scholar Membership |
| **Handle** | `membership-scholar` |
| **Price** | 29.00 USD |
| **Product type** | Membership |
| **Tags** | membership, study, scholar |

**Checkout path:** Pricing page → Buy → `/cart/add` → `/checkout` (variant id from product).  
Fallback links if products aren’t assigned yet:  
`/products/membership-standard` · `/products/membership-annual` · `/products/membership-scholar`

Free plan does **not** use a product — CTA opens `https://arzive-web.onrender.com/study`.

