"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  authLogin,
  authLogout,
  authSignup,
  fetchMe,
  type AuthSession,
} from "@/lib/api";
import { applyServerUsage, type PlanId } from "@/lib/plan";

const STORAGE_KEY = "arzive.session";

type AuthContextValue = {
  user: AuthSession | null;
  ready: boolean;
  userId: string;
  authHeaders: Record<string, string>;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStored(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);

  // Restore the saved session, then confirm it with the server so an expired
  // token (or a plan that changed since last visit) doesn't linger in the UI.
  useEffect(() => {
    let cancelled = false;
    const stored = readStored();
    const finish = (session: AuthSession | null) => {
      if (cancelled) return;
      setUser(session);
      setReady(true);
    };
    if (!stored?.token) {
      void Promise.resolve().then(() => finish(null));
      return () => {
        cancelled = true;
      };
    }
    // Don't keep the page waiting if the backend is slow or unreachable.
    const timeout = new Promise<never>((_, reject) =>
      window.setTimeout(() => reject(new Error("timeout")), 6000),
    );
    Promise.race([fetchMe({ Authorization: `Bearer ${stored.token}` }), timeout])
      .then((fresh) => {
        const next = { ...stored, ...fresh };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        if (next.plan) applyServerUsage({ plan: next.plan as PlanId });
        finish(next);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.message === "Not signed in.") {
          // Session expired or was revoked on the server.
          window.localStorage.removeItem(STORAGE_KEY);
          applyServerUsage({ plan: "free" });
          finish(null);
        } else {
          // Offline / backend unreachable: keep the cached session.
          finish(stored);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((session: AuthSession | null) => {
    setUser(session);
    if (typeof window === "undefined") return;
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      if (session.plan) {
        applyServerUsage({ plan: session.plan as PlanId });
      }
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
      applyServerUsage({ plan: "free" });
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string) => {
      const session = await authSignup(email, password);
      persist(session);
    },
    [persist],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const session = await authLogin(email, password);
      persist(session);
    },
    [persist],
  );

  const signOut = useCallback(async () => {
    const token = user?.token;
    try {
      await authLogout(token);
    } catch {
      // Client clears regardless.
    }
    persist(null);
  }, [persist, user?.token]);

  const value = useMemo<AuthContextValue>(() => {
    const userId = user?.id || "local-dev-user";
    const authHeaders: Record<string, string> = {
      "X-User-Id": userId,
    };
    if (user?.token) {
      authHeaders.Authorization = `Bearer ${user.token}`;
    }
    return {
      user,
      ready,
      userId,
      authHeaders,
      signUp,
      signIn,
      signOut,
    };
  }, [user, ready, signUp, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
