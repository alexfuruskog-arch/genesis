export type Product = {
  id: "cornell" | "math";
  slug: string;
  name: string;
  shortName: string;
  colorName: string;
  colorHex: string;
  tagline: string;
  description: string;
  coverImage: string;
  layoutImage: string;
  shopifyHandle: string;
  priceLabel: string;
};

const cornellHandle =
  process.env.NEXT_PUBLIC_SHOPIFY_CORNELL_HANDLE?.trim() || "cornell-notebook";
const mathHandle =
  process.env.NEXT_PUBLIC_SHOPIFY_MATH_HANDLE?.trim() || "math-notebook";

export const products: Product[] = [
  {
    id: "cornell",
    slug: "cornell",
    name: "Cream Cornell Notebook",
    shortName: "Cornell",
    colorName: "Cream",
    colorHex: "#f3efe6",
    tagline: "Structured thinking",
    description:
      "Cue, Main Notes, and Summary — the classic Cornell system on recycled cream paper, spiral-bound for lectures and revision. Scan pages into Study with Arzive when you are ready to practice.",
    coverImage: "/products/notebook-cream.jpg",
    layoutImage: "/products/cornell-pages.jpg",
    shopifyHandle: cornellHandle,
    priceLabel: "Checkout on Shopify",
  },
  {
    id: "math",
    slug: "math",
    name: "Green Math Notebook",
    shortName: "Math",
    colorName: "Forest green",
    colorHex: "#1a2e26",
    tagline: "Mathematical clarity",
    description:
      "Grid for Example and Practice Questions, with Formulas and Explanations beside — built for problem sets that need room to think. Forest-green cover, same ARZIVE spiral system.",
    coverImage: "/products/notebook-green.jpg",
    layoutImage: "/products/math-pages.jpg",
    shopifyHandle: mathHandle,
    priceLabel: "Checkout on Shopify",
  },
];

export function shopifyProductUrl(
  handle: string,
  storeDomain?: string,
): string | null {
  const domain = (storeDomain || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (!domain) return null;
  return `https://${domain}/products/${handle}`;
}
