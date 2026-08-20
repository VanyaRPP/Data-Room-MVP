"use client";

import { useEffect } from "react";
import { FolderInputIcon, Trash2Icon, XIcon } from "lucide-react";
import type { NodeDto } from "@dataroom/shared";
import { Button } from "@/components/ui/button";

interface SelectionToolbarProps {
  nodes: NodeDto[];
  onMove: () => void;
  onDelete: () => void;
  onClear: () => void;
}

/**
 * The bar that appears once rows are ticked, offering what can be done to all
 * of them at once.
 *
 * It floats over the table rather than sitting above it: the actions belong to
 * the selection, so they should arrive with it and leave with it instead of
 * pushing the rows the user is picking from around the page.
 *
 * Only the two operations that generalise are here. Rename and Share stay on
 * the row menu - one new name cannot serve five files, and a link points at a
 * single node.
 */
export function SelectionToolbar({
  nodes,
  onMove,
  onDelete,
  onClear,
}: SelectionToolbarProps) {
  // Escape is how every other transient thing in the app is dismissed, and a
  // selection you cannot get out of without aiming at a small × is a trap.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClear();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClear]);

  if (nodes.length === 0) return null;

  const folders = nodes.filter((node) => node.type === "FOLDER").length;
  const breakdown = [
    folders > 0 && plural(folders, "folder"),
    nodes.length - folders > 0 && plural(nodes.length - folders, "file"),
  ]
    .filter((part): part is string => part !== false)
    .join(", ");

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="bg-popover animate-in fade-in slide-in-from-bottom-2 pointer-events-auto flex items-center gap-1 rounded-full border py-1.5 pr-1.5 pl-4 shadow-lg duration-200">
        <span className="text-sm font-medium whitespace-nowrap">
          {nodes.length} selected
        </span>
        <span className="text-muted-foreground hidden text-sm whitespace-nowrap sm:inline">
          · {breakdown}
        </span>

        <span className="bg-border mx-2 h-5 w-px" aria-hidden="true" />

        <Button size="sm" variant="ghost" className="rounded-full" onClick={onMove}>
          <FolderInputIcon />
          Move
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
          onClick={onDelete}
        >
          <Trash2Icon />
          Delete
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="rounded-full"
          onClick={onClear}
          aria-label="Clear the selection"
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
