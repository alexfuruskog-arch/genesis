export const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";

/** Custom domain first; myshopify fallback. */
export const shopifyStoreDomain =
  process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "arzive.com";

export const shopifyCornellHandle =
  process.env.NEXT_PUBLIC_SHOPIFY_CORNELL_HANDLE ?? "arzive-cornell-notebook";
export const shopifyMathHandle =
  process.env.NEXT_PUBLIC_SHOPIFY_MATH_HANDLE ?? "arzive-math-notebook";
export const shopifyStandardHandle =
  process.env.NEXT_PUBLIC_SHOPIFY_STANDARD_HANDLE ?? "membership-standard";
export const shopifyAnnualHandle =
  process.env.NEXT_PUBLIC_SHOPIFY_ANNUAL_HANDLE ?? "membership-annual";
export const shopifyScholarHandle =
  process.env.NEXT_PUBLIC_SHOPIFY_SCHOLAR_HANDLE ?? "membership-scholar";
export const shopifyStorefrontToken =
  process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN ?? "";
export const shopifyApiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? "";

export function shopifyStoreUrl(path = ""): string {
  const domain = shopifyStoreDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const clean = path.startsWith("/") ? path : path ? `/${path}` : "";
  return `https://${domain}${clean}`;
}

export function shopifyMembershipUrl(plan: "standard" | "annual" | "scholar"): string {
  const handles = {
    standard: shopifyStandardHandle,
    annual: shopifyAnnualHandle,
    scholar: shopifyScholarHandle,
  };
  return shopifyStoreUrl(`/products/${handles[plan]}`);
}

export const publicConfig = {
  convexConfigured: Boolean(convexUrl),
  shopifyConfigured: Boolean(shopifyStoreDomain),
  shopifyStoreDomain,
};
