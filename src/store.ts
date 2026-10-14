import { create } from "zustand";
import { type ConnectionConfig } from "./api";

const SHELL_KEY = "dockstation.shell";

function initialShell(): string {
  return localStorage.getItem(SHELL_KEY) || "bash";
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
  setConnection: (connection: ConnectionConfig | null) => void;
  setVersion: (serverVersion: string, apiVersion: string) => void;
  bumpEvent: () => void;
  setShowStopped: (value: boolean) => void;
  bumpRefresh: () => void;
  toggleStatsSelection: (id: string, checked: boolean) => void;
  setShell: (shell: string) => void;
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
}));
