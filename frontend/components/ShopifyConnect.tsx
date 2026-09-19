"use client";

import { useEffect, useState } from "react";

import {
  connectShopifyShop,
  createShopifyCheckout,
  disconnectShopifyShop,
  fetchShopifyProducts,
  fetchShopifyStatus,
  linkShopifyCustomer,
  type ShopifyProduct,
  type ShopifyStatus,
} from "@/lib/api";

type Props = {
  disabled?: boolean;
  onStatus?: (status: ShopifyStatus | null) => void;
};

export function ShopifyConnect({ disabled, onStatus }: Props) {
  const [status, setStatus] = useState<ShopifyStatus | null>(null);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [shop, setShop] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    const next = await fetchShopifyStatus();
    setStatus(next);
    onStatus?.(next);
    if (next.shop_domain) setShop(next.shop_domain.replace(".myshopify.com", ""));
    if (!next.has_oauth_app) setShowToken(true);
    if (next.connected) {
      try {
        setProducts(await fetchShopifyProducts());
      } catch {
        setProducts([]);
      }
    } else {
      setProducts([]);
    }
    return next;
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await refresh();
        if (!cancelled) setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Kunde inte läsa Shopify-status.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onConnect(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await connectShopifyShop({
        shop,
        admin_api_token: showToken ? token : undefined,
      });
      if (result.authorize_url) {
        window.location.assign(result.authorize_url);
        return;
      }
      setNotice(`Butiken ${result.install?.shop_name || result.install?.shop_domain} är kopplad.`);
      await refresh();
      setToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte koppla Shopify.");
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect() {
    setBusy(true);
    setError(null);
    try {
      await disconnectShopifyShop();
      setNotice("Shopify-kopplingen är borttagen.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte koppla från.");
    } finally {
      setBusy(false);
    }
  }

  async function onLinkCustomer(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await linkShopifyCustomer({
        email,
        display_name: displayName || undefined,
      });
      setNotice("Användaren är länkad till en Shopify-kund.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte länka kunden.");
    } finally {
      setBusy(false);
    }
  }

  async function onCheckout(variantId: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await createShopifyCheckout(variantId);
      if (result.checkout.invoice_url) {
        window.open(result.checkout.invoice_url, "_blank", "noopener,noreferrer");
      }
      setNotice(
        result.checkout.invoice_url
          ? "Draft order skapad — Shopify-kassan öppnas i en ny flik."
          : "Draft order skapad i Shopify.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout misslyckades.");
    } finally {
      setBusy(false);
    }
  }

  const connected = Boolean(status?.connected);
  const linkedEmail =
    typeof status?.linked_customer?.email === "string"
      ? status.linked_customer.email
      : null;

  return (
    <section className="rounded-3xl border border-ink/8 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Koppla Shopify</h2>
          <p className="mt-1 text-sm text-ink/65">
            Koppla din butik för tentapaket och kundsynk. Custom app med Admin
            API-token går att använda direkt. OAuth används när Client ID/Secret
            är satta på servern.
          </p>
        </div>
        <p
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            connected ? "bg-emerald-50 text-emerald-800" : "bg-paper text-ink/70"
          }`}
        >
          {connected
            ? status?.shop_name || status?.shop_domain
            : "Inte kopplad"}
        </p>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-ink/60">Hämtar Shopify-status…</p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      {notice ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {notice}
        </p>
      ) : null}

      {!loading && !connected ? (
        <form onSubmit={onConnect} className="mt-5 space-y-3">
          <label className="block text-sm">
            <span className="font-medium">Butik</span>
            <input
              value={shop}
              onChange={(event) => setShop(event.target.value)}
              placeholder="mystore eller mystore.myshopify.com"
              disabled={disabled || busy}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 outline-none focus:border-copper"
              required
            />
          </label>
          <button
            type="button"
            onClick={() => setShowToken((value) => !value)}
            className="text-sm font-medium text-copper"
          >
            {showToken ? "Dölj Admin API-token" : "Jag har en Admin API-token"}
          </button>
          {showToken ? (
            <label className="block text-sm">
              <span className="font-medium">Admin API access token</span>
              <input
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="shpat_…"
                disabled={disabled || busy}
                className="mt-1 w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 outline-none focus:border-copper"
                required
              />
            </label>
          ) : (
            <p className="text-sm text-ink/60">
              {status?.has_oauth_app
                ? `OAuth är redo. Redirect URI i Shopify-appen: ${status.oauth_redirect_uri}`
                : "Utan OAuth-app: skapa en custom app i Shopify Admin → Settings → Apps, ge scopes read/write customers, read products, write draft orders, och klistra in token här."}
            </p>
          )}
          <button
            type="submit"
            disabled={disabled || busy}
            className="inline-flex w-full items-center justify-center rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-paper hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {busy
              ? "Kopplar…"
              : showToken
                ? "Koppla med token"
                : status?.has_oauth_app
                  ? "Installera i Shopify"
                  : "Koppla butik"}
          </button>
        </form>
      ) : null}

      {!loading && connected ? (
        <div className="mt-5 space-y-6">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink/55">Butik</dt>
              <dd className="font-medium">{status?.shop_domain}</dd>
            </div>
            <div>
              <dt className="text-ink/55">Metod</dt>
              <dd className="font-medium">{status?.connection_method}</dd>
            </div>
          </dl>

          <form onSubmit={onLinkCustomer} className="space-y-3 rounded-2xl bg-paper p-4">
            <h3 className="text-sm font-semibold">Länka app-användare till Shopify-kund</h3>
            {linkedEmail ? (
              <p className="text-sm text-ink/70">Nuvarande länk: {linkedEmail}</p>
            ) : (
              <p className="text-sm text-ink/60">Ingen kund är länkad ännu.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="kund@example.com"
                disabled={busy}
                className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-copper"
              />
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Namn (valfritt)"
                disabled={busy}
                className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-copper"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-copper px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Länkar…" : "Länka kund"}
            </button>
          </form>

          <div>
            <h3 className="text-sm font-semibold">Produkter</h3>
            {products.length === 0 ? (
              <p className="mt-2 text-sm text-ink/60">
                Inga produkter hittades. Kolla att appen har `read_products`.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {products.map((product) => {
                  const variant = product.variants[0];
                  return (
                    <li
                      key={product.id}
                      className="flex flex-col gap-2 rounded-2xl border border-ink/8 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium">{product.title}</p>
                        <p className="text-xs text-ink/60">
                          {variant
                            ? `${variant.title} · ${variant.price}`
                            : product.status}
                        </p>
                      </div>
                      {variant ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onCheckout(variant.id)}
                          className="rounded-xl border border-ink/10 px-3 py-2 text-sm font-medium hover:border-copper/40 disabled:opacity-60"
                        >
                          Skapa checkout
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {status?.connection_method === "env" ? (
            <p className="text-xs text-ink/55">
              Kopplingen kommer från miljövariabler. Ta bort SHOPIFY_ADMIN_API_TOKEN
              för att koppla från helt.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void onDisconnect()}
              disabled={busy}
              className="text-sm text-ink/60 underline disabled:opacity-60"
            >
              Koppla från butik
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
