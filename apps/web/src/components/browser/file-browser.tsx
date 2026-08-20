"use client";

import { useState, type ReactNode } from "react";
import { CornerLeftUpIcon, FileTextIcon, FolderIcon } from "lucide-react";
import type { NodeDto } from "@dataroom/shared";
import { Button } from "@/components/ui/button";
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
   * Enables dragging a row onto a folder row to move it there. Undefined on
   * read-only views, which makes every row undraggable.
   */
  onMoveNode?: (node: NodeDto, targetFolder: FolderTarget) => void;
  /**
   * The folder one level up, shown as a row that navigates there and accepts
   * dropped rows. Absent at the top of the tree - and in a shared view that
   * top is the shared folder, not the owner's room root.
   */
  parentFolder?: ParentFolder | null;
}

export interface FolderTarget {
  id: string;
  name: string;
}

export interface ParentFolder extends FolderTarget {
  onOpen: () => void;
  /** Absent on read-only views, leaving the row navigation-only. */
  onDrop?: (node: NodeDto) => void;
}

/** Marks a drag as coming from inside the table rather than the desktop. */
const NODE_DRAG_TYPE = "application/x-dataroom-node";

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
  onMoveNode,
  parentFolder,
}: FileBrowserProps) {
  // The id being dragged, so a folder can tell whether it is a legal target
  // for it. dataTransfer's payload is deliberately unreadable during dragover,
  // so the only way to know is to remember what the drag started with.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [overParent, setOverParent] = useState(false);

  const isDraggable = onMoveNode !== undefined;

  function canDropOn(node: NodeDto): boolean {
    return (
      isDraggable &&
      node.type === "FOLDER" &&
      draggingId !== null &&
      draggingId !== node.id
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

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-28">Size</TableHead>
            <TableHead className="w-36">Modified</TableHead>
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
                if (!parentFolder.onDrop || draggingId === null) return;
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
                if (!parentFolder.onDrop || draggingId === null) return;
                event.preventDefault();
                event.stopPropagation();

                const movedId = event.dataTransfer.getData(NODE_DRAG_TYPE);
                const moved = items.find((item) => item.id === movedId);
                setDraggingId(null);
                setOverParent(false);
                if (moved) parentFolder.onDrop(moved);
              }}
              className={cn(
                "cursor-pointer",
                overParent && "bg-accent outline-primary -outline-offset-2 outline-2",
              )}
            >
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
              draggable={isDraggable}
              onDragStart={(event) => {
                setDraggingId(node.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(NODE_DRAG_TYPE, node.id);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setDropTargetId(null);
                setOverParent(false);
              }}
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

                const movedId = event.dataTransfer.getData(NODE_DRAG_TYPE);
                const moved = items.find((item) => item.id === movedId);
                setDraggingId(null);
                setDropTargetId(null);
                if (moved) onMoveNode?.(moved, node);
              }}
              className={cn(
                draggingId === node.id && "opacity-40",
                dropTargetId === node.id &&
                  "bg-accent outline-primary -outline-offset-2 outline-2",
              )}
            >
              {/* max-w-0 with w-full is what lets the cell's content truncate
                  instead of forcing the table wider than its container. */}
              <TableCell className="w-full max-w-0">
                <NodeName
                  node={node}
                  onOpen={node.type === "FOLDER" ? onOpenFolder : onOpenFile}
                />
              </TableCell>
              <TableCell className="text-muted-foreground tabular-nums">
                {formatBytes(node.size)}
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
