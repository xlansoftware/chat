"use client";

import { useCallback, useEffect, useState } from "react";

interface UsageTokens {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
}

export type UsageState = {
  totalUsage?: UsageTokens;
  lastStepUsage?: UsageTokens;
  updatedAt?: number;
};

type UseUsageResult = {
  usage: UsageState | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useUsage(threadId?: string): UseUsageResult {
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    if (!threadId) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/usage?threadId=${encodeURIComponent(threadId)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch usage (${res.status})`);
      }

      const data = await res.json();
      setUsage(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unknown error fetching usage"
      );
    } finally {
      setIsLoading(false);
    }
  }, [threadId]);

  // Optional auto-fetch when threadId changes
  useEffect(() => {
    if (!threadId) return;
    fetchUsage();
  }, [threadId, fetchUsage]);

  return {
    usage,
    isLoading,
    error,
    refetch: fetchUsage,
  };
}
