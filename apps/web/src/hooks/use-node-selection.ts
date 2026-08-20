"use client";

import { useCallback, useMemo, useState } from "react";
import type { NodeDto } from "@dataroom/shared";

const NOTHING: ReadonlySet<string> = new Set();

interface SelectionState {
  /** What the ids belong to. A different folder means a different selection. */
  scope: string;
  ids: ReadonlySet<string>;
  /** Where a shift-click measures its range from. */
  anchorId: string | null;
}

export interface NodeSelection {
  /** The selected items, in the order the listing shows them. */
  nodes: NodeDto[];
  has: (nodeId: string) => boolean;
  /** `extend` is a shift-click: everything between the anchor and here. */
  toggle: (node: NodeDto, extend: boolean) => void;
  /** Selects every loaded item, or clears them if they are all selected. */
  toggleAll: () => void;
  clear: () => void;
}

/**
 * Which rows of a listing are picked out for a bulk action.
 *
 * Two things keep it honest. The selection is scoped, so navigating to another
 * folder starts empty rather than carrying ids the user can no longer see; and
 * it is intersected with what is actually listed, so filtering the table down
 * narrows the selection with it. Nothing can be acted on that isn't on screen.
 *
 * Ids that fall out of view are kept rather than dropped: clearing a filter
 * brings the selection back, which is what someone who filtered by accident
 * expects.
 */
export function useNodeSelection(
  items: NodeDto[],
  scope: string,
): NodeSelection {
  const [state, setState] = useState<SelectionState>({
    scope,
    ids: NOTHING,
    anchorId: null,
  });

  // Adjusting during render rather than in an effect: an effect would let one
  // frame paint the previous folder's selection over this folder's rows.
  const ids = state.scope === scope ? state.ids : NOTHING;

  const nodes = useMemo(
    () => (ids.size === 0 ? [] : items.filter((item) => ids.has(item.id))),
    [items, ids],
  );

  const toggle = useCallback(
    (node: NodeDto, extend: boolean) => {
      setState((current) => {
        const previous = current.scope === scope ? current : null;
        const next = new Set(previous?.ids ?? NOTHING);

        const anchorIndex = items.findIndex(
          (item) => item.id === previous?.anchorId,
        );
        const index = items.findIndex((item) => item.id === node.id);

        if (extend && anchorIndex !== -1 && index !== -1) {
          // A range always selects; shift-clicking is how you widen a
          // selection, never how you punch a hole in one.
          const [from, to] = [anchorIndex, index].sort((a, b) => a - b) as [
            number,
            number,
          ];
          for (const item of items.slice(from, to + 1)) next.add(item.id);
          return { scope, ids: next, anchorId: node.id };
        }

        if (!next.delete(node.id)) next.add(node.id);
        return { scope, ids: next, anchorId: node.id };
      });
    },
    [items, scope],
  );

  const toggleAll = useCallback(() => {
    setState((current) => {
      const selected = current.scope === scope ? current.ids : NOTHING;
      const allSelected =
        items.length > 0 && items.every((item) => selected.has(item.id));

      return {
        scope,
        ids: allSelected ? NOTHING : new Set(items.map((item) => item.id)),
        anchorId: null,
      };
    });
  }, [items, scope]);

  const clear = useCallback(() => {
    setState({ scope, ids: NOTHING, anchorId: null });
  }, [scope]);

  const has = useCallback((nodeId: string) => ids.has(nodeId), [ids]);

  return { nodes, has, toggle, toggleAll, clear };
}
