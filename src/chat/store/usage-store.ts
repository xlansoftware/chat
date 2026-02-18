import { create } from "zustand";

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
  tokensPerSecond?: number;
  updatedAt?: number;
};

type UsageStore = {
  usage: UsageState | null;
  isLoading: boolean;
  error: string | null;
  threadId?: string;

  fetchUsage: (threadId?: string) => Promise<void>;
  clear: () => void;
};

export const useUsageStore = create<UsageStore>((set) => ({
  usage: null,
  isLoading: false,
  error: null,
  threadId: undefined,

  fetchUsage: async (threadId?: string) => {
    if (!threadId) return;

    set({ threadId, isLoading: true, error: null });

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

      const data: UsageState = await res.json();
      set({ usage: data });
    } catch (err) {
      set({
        error:
          err instanceof Error
            ? err.message
            : "Unknown error fetching usage",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  clear: () =>
    set({
      usage: null,
      error: null,
      isLoading: false,
      threadId: undefined,
    }),
}));
