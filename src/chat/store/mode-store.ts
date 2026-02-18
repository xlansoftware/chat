import { create } from "zustand";

export type Mode = "chat" | "raw";

interface ModeStore {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

export const useModeStore = create<ModeStore>((set) => ({
  mode: "chat",
  setMode: (mode) => set({ mode }),
}));
