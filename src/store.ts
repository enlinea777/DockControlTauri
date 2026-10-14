import { create } from "zustand";
import { type ConnectionConfig } from "./api";

const SHELL_KEY = "dockstation.shell";
const THEME_KEY = "dockstation.theme";

function initialShell(): string {
  return localStorage.getItem(SHELL_KEY) || "bash";
}

export type ThemeMode = "light" | "dark";

function initialTheme(): ThemeMode {
  return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

interface AppStore {
  connection: ConnectionConfig | null;
  serverVersion: string;
  apiVersion: string;
  eventTick: number;
  showStopped: boolean;
  refreshTick: number;
  statsSelection: string[];
  shell: string;
  theme: ThemeMode;
  setConnection: (connection: ConnectionConfig | null) => void;
  setVersion: (serverVersion: string, apiVersion: string) => void;
  bumpEvent: () => void;
  setShowStopped: (value: boolean) => void;
  bumpRefresh: () => void;
  toggleStatsSelection: (id: string, checked: boolean) => void;
  setShell: (shell: string) => void;
  setTheme: (theme: ThemeMode) => void;
}

export const useStore = create<AppStore>((set) => ({
  connection: null,
  serverVersion: "",
  apiVersion: "",
  eventTick: 0,
  showStopped: true,
  refreshTick: 0,
  statsSelection: [],
  shell: initialShell(),
  theme: initialTheme(),
  setConnection: (connection) => set({ connection }),
  setVersion: (serverVersion, apiVersion) => set({ serverVersion, apiVersion }),
  bumpEvent: () => set((state) => ({ eventTick: state.eventTick + 1 })),
  setShowStopped: (showStopped) => set({ showStopped }),
  bumpRefresh: () => set((state) => ({ refreshTick: state.refreshTick + 1 })),
  toggleStatsSelection: (id, checked) =>
    set((state) => ({
      statsSelection: checked
        ? [...new Set([...state.statsSelection, id])]
        : state.statsSelection.filter((x) => x !== id),
    })),
  setShell: (shell) => {
    localStorage.setItem(SHELL_KEY, shell);
    set({ shell });
  },
  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    set({ theme });
  },
}));
