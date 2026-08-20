"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CornerLeftUpIcon,
  FileTextIcon,
  FolderIcon,
} from "lucide-react";
import type { NodeDto, NodeSort, SortDirection } from "@dataroom/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatBytes, formatDate } from "@/lib/format";

/** Longer names get a tooltip, since the column truncates them. */
const TOOLTIP_THRESHOLD = 32;

interface FileBrowserProps {
  items: NodeDto[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  onOpenFolder: (node: NodeDto) => void;
  onOpenFile: (node: NodeDto) => void;
  emptyState: ReactNode;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  /**
   * Row actions, if the viewer may mutate anything. Left undefined on
   * read-only views so the actions never render at all - a disabled menu
   * would still advertise operations that aren't on offer.
   */
  renderRowActions?: (node: NodeDto) => ReactNode;
  /**
   * Enables dragging rows onto a folder row to move them there. Undefined on
   * read-only views, which makes every row undraggable.
   */
  onMoveNodes?: (nodes: NodeDto[], targetFolder: FolderTarget) => void;
  /**
   * Adds the tick boxes that pick rows out for a bulk action. Absent on
   * read-only views, which have no bulk action to offer.
   */
  selection?: BrowserSelection;
  /**
   * The folder one level up, shown as a row that navigates there and accepts
   * dropped rows. Absent at the top of the tree - and in a shared view that
   * top is the shared folder, not the owner's room root.
   */
  parentFolder?: ParentFolder | null;
  /** Makes the column headers sortable. Absent leaves them plain labels. */
  sorting?: {
    sort: NodeSort;
    direction: SortDirection;
    onSort: (column: NodeSort) => void;
  };
}

export interface BrowserSelection {
  /** The picked rows, in listing order. */
  nodes: NodeDto[];
  has: (nodeId: string) => boolean;
  /** `extend` is a shift-click, selecting the range back to the last one. */
  toggle: (node: NodeDto, extend: boolean) => void;
  toggleAll: () => void;
}

export interface FolderTarget {
  id: string;
  name: string;
}

export interface ParentFolder extends FolderTarget {
  onOpen: () => void;
  /** Absent on read-only views, leaving the row navigation-only. */
  onDrop?: (nodes: NodeDto[]) => void;
}

/** Marks a drag as coming from inside the table rather than the desktop. */
const NODE_DRAG_TYPE = "application/x-dataroom-node";

const NOTHING_DRAGGING: ReadonlySet<string> = new Set();

export function FileBrowser({
  items,
  isLoading,
  error,
  onRetry,
  onOpenFolder,
  onOpenFile,
  emptyState,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  renderRowActions,
  onMoveNodes,
  selection,
  parentFolder,
  sorting,
}: FileBrowserProps) {
  // What is being dragged, so a folder can tell whether it is a legal target.
  // dataTransfer's payload is deliberately unreadable during dragover, so the
  // only way to know is to remember what the drag started with.
  const [draggingIds, setDraggingIds] =
    useState<ReadonlySet<string>>(NOTHING_DRAGGING);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [overParent, setOverParent] = useState(false);

  const isDraggable = onMoveNodes !== undefined;

  /**
   * Dragging a row that is part of the selection takes the whole selection
   * with it; dragging any other row is about that row alone, and leaves the
   * selection untouched.
   */
  function dragPayload(node: NodeDto): NodeDto[] {
    return selection?.has(node.id) ? selection.nodes : [node];
  }

  function endDrag(): void {
    setDraggingIds(NOTHING_DRAGGING);
    setDropTargetId(null);
    setOverParent(false);
  }

  function canDropOn(node: NodeDto): boolean {
    return (
      isDraggable &&
      node.type === "FOLDER" &&
      draggingIds.size > 0 &&
      !draggingIds.has(node.id)
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="space-y-1">
          <p className="font-medium">Could not load this folder</p>
          <p className="text-muted-foreground text-sm">{error.message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (isLoading) return <FileBrowserSkeleton />;
  if (items.length === 0) return <>{emptyState}</>;

  // "All" means everything currently listed, not everything in the folder:
  // pages not loaded yet can't be ticked, so claiming them would be a lie.
  const someSelected = selection !== undefined && selection.nodes.length > 0;
  const allSelected =
    someSelected && items.every((item) => selection.has(item.id));

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            {selection && (
              <TableHead className="w-10 pl-4">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  onCheckedChange={selection.toggleAll}
                  aria-label={
                    allSelected
                      ? "Clear the selection"
                      : "Select everything listed"
                  }
                />
              </TableHead>
            )}
            <SortableHeader column="name" sorting={sorting}>
              Name
            </SortableHeader>
            <SortableHeader column="size" sorting={sorting} className="w-28">
              Size
            </SortableHeader>
            <SortableHeader
              column="updated"
              sorting={sorting}
              className="w-36"
            >
              Modified
            </SortableHeader>
            {renderRowActions && (
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {parentFolder && (
            <TableRow
              onClick={parentFolder.onOpen}
              onDragOver={(event) => {
                if (!parentFolder.onDrop || draggingIds.size === 0) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setOverParent(true);
              }}
              onDragLeave={(event) => {
                if (
                  event.currentTarget.contains(event.relatedTarget as Node | null)
                ) {
                  return;
                }
                setOverParent(false);
              }}
              onDrop={(event) => {
                if (!parentFolder.onDrop || draggingIds.size === 0) return;
                event.preventDefault();
                event.stopPropagation();

                const moved = items.filter((item) => draggingIds.has(item.id));
                endDrag();
                if (moved.length > 0) parentFolder.onDrop(moved);
              }}
              className={cn(
                "cursor-pointer",
                overParent && "bg-accent outline-primary -outline-offset-2 outline-2",
              )}
            >
              {/* Nothing to select: this row stands for the folder above, and
                  a folder cannot be moved or deleted from inside itself. */}
              {selection && <TableCell />}
              <TableCell className="w-full max-w-0">
                <span className="text-muted-foreground flex min-w-0 items-center gap-2">
                  <CornerLeftUpIcon className="size-4 shrink-0" />
                  <span className="truncate">{parentFolder.name}</span>
                </span>
              </TableCell>
              <TableCell />
              <TableCell />
              {renderRowActions && <TableCell />}
            </TableRow>
          )}
          {items.map((node) => (
            <TableRow
              key={node.id}
              data-state={selection?.has(node.id) ? "selected" : undefined}
              draggable={isDraggable}
              onDragStart={(event) => {
                const dragged = dragPayload(node);
                setDraggingIds(new Set(dragged.map((item) => item.id)));
                event.dataTransfer.effectAllowed = "move";
                // Firefox refuses to start a drag without a payload, and the
                // type is what tells a drop target this came from the table
                // rather than the desktop.
                event.dataTransfer.setData(
                  NODE_DRAG_TYPE,
                  dragged.map((item) => item.id).join(","),
                );
              }}
              onDragEnd={endDrag}
              onDragOver={(event) => {
                if (!canDropOn(node)) return;
                // Both of these are required for the row to accept a drop at
                // all, and preventing default is what turns the cursor into a
                // move affordance instead of the "no entry" sign.
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTargetId(node.id);
              }}
              onDragLeave={(event) => {
                // Ignore the events fired while crossing the row's own cells.
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  return;
                }
                setDropTargetId((current) =>
                  current === node.id ? null : current,
                );
              }}
              onDrop={(event) => {
                if (!canDropOn(node)) return;
                event.preventDefault();
                // Keep it from reaching the upload dropzone wrapping the table.
                event.stopPropagation();

                const moved = items.filter((item) => draggingIds.has(item.id));
                endDrag();
                if (moved.length > 0) onMoveNodes?.(moved, node);
              }}
              className={cn(
                draggingIds.has(node.id) && "opacity-40",
                dropTargetId === node.id &&
                  "bg-accent outline-primary -outline-offset-2 outline-2",
              )}
            >
              {selection && (
                <TableCell className="pl-4">
                  <Checkbox
                    checked={selection.has(node.id)}
                    onCheckedChange={(_checked, details) =>
                      selection.toggle(
                        node,
                        details.event instanceof MouseEvent &&
                          details.event.shiftKey,
                      )
                    }
                    aria-label={`Select ${node.name}`}
                  />
                </TableCell>
              )}
              {/* max-w-0 with w-full is what lets the cell's content truncate
                  instead of forcing the table wider than its container. */}
              <TableCell className="w-full max-w-0">
                <NodeName
                  node={node}
                  onOpen={node.type === "FOLDER" ? onOpenFolder : onOpenFile}
                />
              </TableCell>
              <TableCell className="text-muted-foreground tabular-nums">
                <NodeSize node={node} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(node.updatedAt)}
              </TableCell>
              {renderRowActions && (
                <TableCell className="text-right">
                  {renderRowActions(node)}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {hasNextPage && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * A column heading that sorts when clicked, and reverses when clicked again.
 *
 * Sorting lives in the headers rather than a separate control: it is where
 * people look for it in a table, and it costs no extra chrome above one.
 */
function SortableHeader({
  column,
  sorting,
  className,
  children,
}: {
  column: NodeSort;
  sorting: FileBrowserProps["sorting"];
  className?: string;
  children: ReactNode;
}) {
  if (!sorting) return <TableHead className={className}>{children}</TableHead>;

  const isActive = sorting.sort === column;

  return (
    // aria-sort belongs to the column, not to the control inside it: it
    // describes how the data is ordered, which is a property of the header
    // cell rather than of the button that changes it.
    <TableHead
      className={className}
      aria-sort={
        isActive
          ? sorting.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        type="button"
        onClick={() => sorting.onSort(column)}
        aria-label={`Sort by ${column}`}
        className={cn(
          "hover:text-foreground -mx-1 flex cursor-pointer items-center gap-1 rounded px-1",
          !isActive && "text-muted-foreground",
        )}
      >
        {children}
        {isActive &&
          (sorting.direction === "asc" ? (
            <ArrowUpIcon className="size-3" />
          ) : (
            <ArrowDownIcon className="size-3" />
          ))}
      </button>
    </TableHead>
  );
}

/**
 * A file reports its own size; a folder reports what it contains.
 *
 * The folder figure comes from a running total kept on the row, not from a
 * query per line - which is the whole reason those totals exist. The tooltip
 * spells out what makes up the number, since "48 MB" alone does not say
 * whether that is one document or two hundred.
 */
function NodeSize({ node }: { node: NodeDto }) {
  if (node.type === "FILE") return <>{formatBytes(node.size)}</>;

  const isEmpty = node.subtreeFiles === 0 && node.subtreeFolders === 0;
  if (isEmpty) return <span className="text-muted-foreground/60">Empty</span>;

  const contents = [
    node.subtreeFolders > 0 && plural(node.subtreeFolders, "folder"),
    node.subtreeFiles > 0 && plural(node.subtreeFiles, "file"),
  ]
    .filter((part): part is string => part !== false)
    .join(", ");

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="cursor-default" />}>
        {formatBytes(node.subtreeBytes)}
      </TooltipTrigger>
      <TooltipContent>Contains {contents}</TooltipContent>
    </Tooltip>
  );
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function NodeName({
  node,
  onOpen,
}: {
  node: NodeDto;
  onOpen: (node: NodeDto) => void;
}) {
  const element = (
    <button
      type="button"
      onClick={() => onOpen(node)}
      className={cn(
        "flex min-w-0 cursor-pointer items-center gap-2 text-left hover:underline",
        node.type === "FOLDER" && "font-medium",
      )}
    >
      {node.type === "FOLDER" ? (
        <FolderIcon className="text-muted-foreground size-4 shrink-0" />
      ) : (
        <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
      )}
      <span className="truncate">{node.name}</span>
    </button>
  );

  if (node.name.length <= TOOLTIP_THRESHOLD) return element;

  return (
    <Tooltip>
      <TooltipTrigger render={element} />
      <TooltipContent>{node.name}</TooltipContent>
    </Tooltip>
  );
}

function FileBrowserSkeleton() {
  return (
    <div className="space-y-3 p-2">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-4 shrink-0 rounded" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
