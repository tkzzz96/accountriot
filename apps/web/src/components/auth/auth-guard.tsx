"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";

const Spinner = () => (
  <div className="flex h-screen items-center justify-center bg-background" role="status" aria-label="Loading">
    <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

/** Renders children only for a signed-in user (verified with GET /auth/me, not with a client-side flag). */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);
  if (loading || !user) return <Spinner />;
  return <>{children}</>;
}
