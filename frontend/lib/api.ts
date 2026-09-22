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
  storage_backend?: string | null;
  notebook_model?: string | null;
  source_kind?: "scan" | "lecture" | null;
  kind_label?: string | null;
  store?: string;
  extraction_mode?: string;
  message?: string;
};

export type QuizQuestion = {
  id: string;
  question: string;
  choices: string[];
  correct_index: number;
  explanation: string;
};

export type Flashcard = {
  id: string;
  front: string;
  back: string;
};

export type StudyResponse = {
  quiz_session_id: string;
  document_id: string | null;
  document_ids: string[];
  output_type: "quiz" | "flashcards";
  provider: string;
  retrieval: {
    mode: string;
    chunk_count: number;
    document_count?: number;
  };
  questions: QuizQuestion[];
  flashcards: Flashcard[];
  store: string;
};

export type QuizResponse = StudyResponse;

export type PlanId = "free" | "standard" | "annual" | "scholar";

export type AuthSession = {
  id: string;
  email: string;
  source: string;
  token: string;
  message?: string | null;
  plan?: PlanId;
  plan_label?: string;
  unlimited?: boolean;
  billing_status?: string;
  plan_expires_at?: string | null;
  chats_used?: number;
  chats_cap?: number;
  chats_remaining?: number;
  scans_used?: number;
  scans_cap?: number;
  scans_remaining?: number;
};

export type MembershipSnapshot = {
  plan: PlanId;
  plan_label: string;
  unlimited: boolean;
  billing_status: string;
  plan_expires_at: string | null;
  chats_used: number;
  chats_cap: number;
  chats_remaining: number;
  scans_used: number;
  scans_cap: number;
  scans_remaining: number;
  email: string | null;
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

type RequestOptions = RequestInit & {
  authHeaders?: Record<string, string>;
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
    return response.statusText || "Something went wrong talking to the API.";
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { authHeaders, headers, ...rest } = options;
  const response = await fetch(`${apiUrl}${path}`, {
    ...rest,
    headers: {
      ...(authHeaders || {}),
      ...(headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export async function fetchHealth(): Promise<HealthResponse> {
  return request("/health", { cache: "no-store" });
}

export async function uploadDocument(
  file: File,
  authHeaders?: Record<string, string>,
  options?: {
    notebookModel?: "math" | "cornell" | null;
    sourceKind?: "scan" | "lecture";
  },
): Promise<UploadedDocument> {
  const body = new FormData();
  body.append("file", file);
  if (options?.notebookModel) {
    body.append("notebook_model", options.notebookModel);
  }
  if (options?.sourceKind) {
    body.append("source_kind", options.sourceKind);
  }
  return request("/upload-document", {
    method: "POST",
    body,
    authHeaders,
  });
}

export async function fetchDocumentFile(
  documentId: string,
  authHeaders?: Record<string, string>,
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${apiUrl}/documents/${documentId}/file`, {
    cache: "no-store",
    headers: { ...(authHeaders || {}) },
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const disposition = response.headers.get("content-disposition") || "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const blob = await response.blob();
  return { blob, filename: match?.[1] || "file" };
}

export async function listDocuments(
  authHeaders?: Record<string, string>,
): Promise<{
  documents: UploadedDocument[];
  store: string;
  cloud_enabled?: boolean;
}> {
  return request("/documents", { cache: "no-store", authHeaders });
}

export async function generateStudy(
  input: {
    documentIds: string[];
    outputType: "quiz" | "flashcards";
    questionCount?: number;
  },
  authHeaders?: Record<string, string>,
): Promise<StudyResponse> {
  return request("/generate-study", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    authHeaders,
    body: JSON.stringify({
      document_ids: input.documentIds,
      output_type: input.outputType,
      question_count: input.questionCount ?? 5,
    }),
  });
}

export async function generateQuiz(
  documentId: string,
  questionCount = 5,
  authHeaders?: Record<string, string>,
): Promise<StudyResponse> {
  return generateStudy(
    { documentIds: [documentId], outputType: "quiz", questionCount },
    authHeaders,
  );
}

export async function authSignup(email: string, password: string): Promise<AuthSession> {
  return request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function authLogin(email: string, password: string): Promise<AuthSession> {
  return request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function authLogout(token?: string): Promise<void> {
  await request("/auth/logout", {
    method: "POST",
    authHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function fetchMe(
  authHeaders?: Record<string, string>,
): Promise<AuthSession> {
  return request("/auth/me", { cache: "no-store", authHeaders });
}

export async function fetchMembership(
  authHeaders?: Record<string, string>,
): Promise<MembershipSnapshot> {
  return request("/membership/me", { cache: "no-store", authHeaders });
}

export async function fetchShopifyStatus(): Promise<ShopifyStatus> {
  return request("/shopify/status", { cache: "no-store" });
}

export async function connectShopifyShop(input: {
  shop: string;
  admin_api_token?: string;
}): Promise<ShopifyConnectResult> {
  return request("/shopify/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function disconnectShopifyShop(): Promise<void> {
  await request("/shopify/disconnect", { method: "POST" });
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
  return request(`/shopify/oauth/complete${qs}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchShopifyProducts(): Promise<ShopifyProduct[]> {
  const body = await request<{ products: ShopifyProduct[] }>("/shopify/products", {
    cache: "no-store",
  });
  return body.products ?? [];
}

export async function linkShopifyCustomer(input: {
  email: string;
  display_name?: string;
}): Promise<void> {
  await request("/shopify/customers/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function createShopifyCheckout(
  variantId: string,
  quantity = 1,
): Promise<ShopifyCheckout> {
  return request("/shopify/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variant_id: variantId, quantity }),
  });
}
