"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";

export interface AuthUser { id: string; name: string; email: string }
export interface AuthWorkspace { id: string; name: string; slug: string }
export type AuthRole = "owner" | "admin" | "member" | string;

interface Session { user: AuthUser; workspace: AuthWorkspace; role?: AuthRole }
interface AuthContextValue {
  user: AuthUser | null;
  workspace: AuthWorkspace | null;
  role: AuthRole | null;
  /** true until the first /auth/me answer arrives */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, workspaceName: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** The session lives in an httpOnly cookie, so the only way to know who is signed in is to ask the API. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setSession(await api.get<Session>("/auth/me"));
    } catch (err) {
      // 401 => signed out. Network errors keep the previous state so a flaky API does not log the user out.
      if (err instanceof ApiError && err.status === 0) return;
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<Session>("/auth/login", { email, password });
    setSession({ user: data.user, workspace: data.workspace, role: data.role });
    await refresh();
  }, [refresh]);

  const register = useCallback(async (name: string, email: string, password: string, workspaceName: string) => {
    const data = await api.post<Session>("/auth/register", { name, email, password, workspaceName });
    setSession({ user: data.user, workspace: data.workspace, role: data.role });
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Even if the API is unreachable we still leave the app; the cookie expires on its own.
    }
    setSession(null);
    window.location.href = "/login";
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user: session?.user ?? null, workspace: session?.workspace ?? null, role: session?.role ?? null, loading, login, register, logout, refresh }),
    [session, loading, login, register, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
