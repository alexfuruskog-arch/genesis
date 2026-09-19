// Same-origin proxy (next.config.ts rewrites /backend → FastAPI) so Preview
// and Desktop work even when the page is not opened on 127.0.0.1.
export const apiUrl = "/backend";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const shopifyStoreDomain =
  process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "";
export const shopifyCornellHandle =
  process.env.NEXT_PUBLIC_SHOPIFY_CORNELL_HANDLE ?? "cornell-notebook";
export const shopifyMathHandle =
  process.env.NEXT_PUBLIC_SHOPIFY_MATH_HANDLE ?? "arzive-math-notebook";
export const shopifyStorefrontToken =
  process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN ?? "";
export const shopifyApiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? "";

export const publicConfig = {
  apiUrl,
  supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
  shopifyConfigured: Boolean(shopifyStoreDomain),
  shopifyStoreDomain,
};
