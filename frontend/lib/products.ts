export type Product = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  coverImage: string;
  layoutImage: string;
  shopifyHandle: string;
  priceLabel: string;
};

export const products: Product[] = [
  {
    id: "cornell",
    slug: "cornell",
    name: "Cornell Notebook",
    tagline: "Structured thinking",
    description:
      "Cue, notes, and summary — the classic Cornell system on recycled paper, spiral-bound for lectures and revision.",
    coverImage: "/products/notebook-cream.jpg",
    layoutImage: "/products/cornell-pages.jpg",
    shopifyHandle: "cornell-notebook",
    priceLabel: "From Shopify",
  },
  {
    id: "math",
    slug: "math",
    name: "Math Notebook",
    tagline: "Mathematical clarity",
    description:
      "Grid for examples and practice, formulas and explanations beside — built for problem sets that need room to think.",
    coverImage: "/products/notebook-green.jpg",
    layoutImage: "/products/math-pages.jpg",
    shopifyHandle: "math-notebook",
    priceLabel: "From Shopify",
  },
];

export function shopifyProductUrl(handle: string, storeDomain?: string): string | null {
  const domain = (storeDomain || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (!domain) return null;
  return `https://${domain}/products/${handle}`;
}
