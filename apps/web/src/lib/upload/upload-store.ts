import { create } from "zustand";

/**
 * `pending` and `presigning` happen before any bytes move; `uploading` is the
 * only state with meaningful progress; `completing` is the server confirming
 * the object landed. `done` and `error` are terminal.
 */
export type UploadStatus =
  | "pending"
  | "presigning"
  | "uploading"
  | "completing"
  | "done"
  | "error";

export interface UploadItem {
  id: string;
  /** The server's final name once presigned, which may carry a suffix. */
  name: string;
  file: File;
  folderId: string;
  status: UploadStatus;
  progress: number;
  error: string | null;
  /**
   * False for files rejected before anything was attempted - a wrong file type
   * fails again no matter how many times it is retried, so the queue must not
   * offer a button that cannot do anything.
   */
  canRetry: boolean;
}

interface UploadState {
  items: UploadItem[];
  isCollapsed: boolean;
  add: (items: UploadItem[]) => void;
  update: (id: string, patch: Partial<UploadItem>) => void;
  clearFinished: () => void;
  clearAll: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

/**
 * Uploads outlive the folder they started from - the user can navigate away
 * mid-upload - so the queue lives outside the React tree that renders any one
 * folder, and the panel subscribes to it from the app shell.
 */
export const useUploadStore = create<UploadState>((set) => ({
  items: [],
  isCollapsed: false,

  add: (items) =>
    set((state) => ({ items: [...state.items, ...items], isCollapsed: false })),

  update: (id, patch) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    })),

  clearFinished: () =>
    set((state) => ({
      items: state.items.filter((item) => item.status !== "done"),
    })),

  clearAll: () => set({ items: [] }),

  setCollapsed: (isCollapsed) => set({ isCollapsed }),
}));

export function isFinished(status: UploadStatus): boolean {
  return status === "done" || status === "error";
}
