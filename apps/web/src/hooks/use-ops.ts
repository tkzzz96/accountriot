"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface OpsStats {
  leadsByStage: Record<string, number>;
  leadsBySiteStatus: Record<string, number>;
  campaignsByStatus: Record<string, number>;
  integrations: {
    webhook: boolean;
    discoveryDriver: string;
    placesConfigured: boolean;
    llmConfigured: boolean;
    pinterestConfigured: boolean;
    smtpVerify: boolean;
  };
  llm: { draftsToday: number; dailyLimit: number };
  queues: { pipeline: Record<string, number>; scraper: Record<string, number> };
}

/** Real operational status from GET /ops/stats (polled lightly; null while loading or when the API is unreachable). */
export function useOpsStats(pollMs = 0) {
  const [stats, setStats] = useState<OpsStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setStats(await api.get<OpsStats>("/ops/stats"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    void load();
    if (!pollMs) return;
    const id = setInterval(() => void load(), pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);
  return { stats, error, reload: load };
}
