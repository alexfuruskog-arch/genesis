export const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:48721";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const shopifyStoreDomain =
  process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "";
export const shopifyStorefrontToken =
  process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN ?? "";
export const shopifyApiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? "";

export const publicConfig = {
  apiUrl,
  supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
  shopifyConfigured: Boolean(shopifyStoreDomain),
};
