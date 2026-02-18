import { ModelConfig } from "@/types/model-config";
import { create } from "zustand";

interface ModelStoreState {
  /** Read-only list of available models */
  models: readonly Omit<ModelConfig, "api-key">[];

  /** Currently selected modelName */
  currentModel: string | null;

  /** Loading state for initial fetch */
  isLoading: boolean;

  /** Error state (optional but recommended) */
  error: string | null;

  /** Actions */
  loadModels: () => Promise<void>;
  setCurrentModel: (modelName: string) => void;
}

export const useModelStore = create<ModelStoreState>((set, get) => ({
  models: [],
  currentModel: null,
  isLoading: false,
  error: null,

  loadModels: async () => {
    set({ isLoading: true, error: null });

    try {
      const res = await fetch("/api/model");

      if (!res.ok) {
        throw new Error(`Failed to load models (${res.status})`);
      }

      const { current, available }: {
        current: string,
        available: Omit<ModelConfig, "api-key">[]
      } = await res.json();
      const models: Omit<ModelConfig, "api-key">[] = available;

      set(() => ({
        models,
        // Auto-select first model if none is selected
        currentModel: current ?? models[0]?.name ?? null,
        isLoading: false,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Unknown error",
        isLoading: false,
      });
    }
  },

  setCurrentModel: async (name: string) => {
    const { models } = get();

    // Enforce read-only + validity constraint
    const exists = models.some((m) => m.name === name);
    if (!exists) {
      throw new Error(`Model "${name}" does not exist`);
    }

    set({ currentModel: name });
  },
}));
