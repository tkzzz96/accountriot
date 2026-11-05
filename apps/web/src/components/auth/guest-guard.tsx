"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";

/** Login/register pages: bounce signed-in users to the dashboard. */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);
  if (loading || user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background" role="status" aria-label="Loading">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
}
