import { apiUrl } from "./env";

export type HealthResponse = {
  status: string;
  service: string;
  integrations: {
    supabase: boolean;
    llm: string;
    shopify: string;
  };
};

export type UploadedDocument = {
  id: string;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  byte_size: number | null;
  extraction_status: string;
  chunk_count: number;
  created_at: string;
  store: string;
  extraction_mode: string;
  message: string;
};

export type QuizQuestion = {
  id: string;
  question: string;
  choices: string[];
  correct_index: number;
  explanation: string;
};

export type QuizResponse = {
  quiz_session_id: string;
  document_id: string;
  provider: string;
  retrieval: {
    mode: string;
    chunk_count: number;
  };
  questions: QuizQuestion[];
  store: string;
};

export type ShopifyStatus = {
  configured: boolean;
  connected: boolean;
  mode: string;
  connection_method: string | null;
  shop_domain: string | null;
  shop_name: string | null;
  has_oauth_app: boolean;
  has_admin_token: boolean;
  has_webhook_secret?: boolean;
  oauth_redirect_uri: string | null;
  oauth_scopes: string | null;
  linked_customer: Record<string, unknown> | null;
};

export type ShopifyProduct = {
  id: string;
  title: string;
  status: string;
  variants: { id: string; title: string; price: string }[];
};

export type ShopifyConnectResult = {
  connected: boolean;
  method: string;
  authorize_url?: string;
  install?: {
    shop_domain: string;
    shop_name: string | null;
    connection_method: string;
  };
};

export type ShopifyCheckout = {
  checkout: {
    id: string | number | null;
    invoice_url: string | null;
    status: string;
    source: string;
    detail?: string;
  };
  linked_customer: Record<string, unknown> | null;
};

async function parseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) {
      return body.detail.map((item: { msg?: string }) => item.msg).join(" ");
    }
    return JSON.stringify(body);
  } catch {
    return response.statusText || "Något gick fel mot API:t.";
  }
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${apiUrl}/health`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export async function uploadDocument(file: File): Promise<UploadedDocument> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${apiUrl}/upload-document`, {
    method: "POST",
    body,
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export async function generateQuiz(
  documentId: string,
  questionCount = 5,
): Promise<QuizResponse> {
  const response = await fetch(`${apiUrl}/generate-quiz`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document_id: documentId,
      question_count: questionCount,
    }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export async function fetchShopifyStatus(): Promise<ShopifyStatus> {
  const response = await fetch(`${apiUrl}/shopify/status`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export async function connectShopifyShop(input: {
  shop: string;
  admin_api_token?: string;
}): Promise<ShopifyConnectResult> {
  const response = await fetch(`${apiUrl}/shopify/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export async function disconnectShopifyShop(): Promise<void> {
  const response = await fetch(`${apiUrl}/shopify/disconnect`, { method: "POST" });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function completeShopifyOAuth(
  input: {
    shop: string;
    code: string;
    state?: string;
    hmac?: string;
  },
  search = "",
): Promise<ShopifyConnectResult> {
  const qs = search.startsWith("?") ? search : search ? `?${search}` : "";
  const response = await fetch(`${apiUrl}/shopify/oauth/complete${qs}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export async function fetchShopifyProducts(): Promise<ShopifyProduct[]> {
  const response = await fetch(`${apiUrl}/shopify/products`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const body = await response.json();
  return body.products ?? [];
}

export async function linkShopifyCustomer(input: {
  email: string;
  display_name?: string;
}): Promise<void> {
  const response = await fetch(`${apiUrl}/shopify/customers/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function createShopifyCheckout(
  variantId: string,
  quantity = 1,
): Promise<ShopifyCheckout> {
  const response = await fetch(`${apiUrl}/shopify/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variant_id: variantId, quantity }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}
