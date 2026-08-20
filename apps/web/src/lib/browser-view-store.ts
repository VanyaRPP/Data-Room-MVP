import { create } from "zustand";
import type { NodeSort, SortDirection } from "@dataroom/shared";

interface BrowserViewState {
  sort: NodeSort;
  direction: SortDirection;
  /** Clicking the active column reverses it; a new column starts ascending. */
  toggleSort: (column: NodeSort) => void;
}

/**
 * How the file table is sorted, kept outside the page component.
 *
 * Navigating to another folder remounts that component, and a sort that reset
 * every time you opened a folder would be a nuisance. Filters stay in the
 * component precisely because they should not survive: they describe one
 * folder's contents, not a preference.
 */
export const useBrowserView = create<BrowserViewState>((set) => ({
  sort: "name",
  direction: "asc",

  toggleSort: (column) =>
    set((state) =>
      state.sort === column
        ? { direction: state.direction === "asc" ? "desc" : "asc" }
        : { sort: column, direction: "asc" },
    ),
}));
