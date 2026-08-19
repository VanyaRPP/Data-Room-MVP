"use client";

import { useState } from "react";
import { ChevronRightIcon, FolderIcon } from "lucide-react";
import { toast } from "sonner";
import type { NodeDto } from "@dataroom/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useChildren } from "@/hooks/use-children";
import { useMoveNode } from "@/hooks/use-node-mutations";
import { useRooms } from "@/hooks/use-rooms";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface MoveDialogProps {
  node: NodeDto | null;
  folderId: string;
  onOpenChange: (open: boolean) => void;
}

export function MoveDialog({ node, folderId, onOpenChange }: MoveDialogProps) {
  return (
    <Dialog open={node !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {node && (
          <MoveDialogBody
            key={node.id}
            node={node}
            folderId={folderId}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MoveDialogBody({
  node,
  folderId,
  onClose,
}: {
  node: NodeDto;
  folderId: string;
  onClose: () => void;
}) {
  const rooms = useRooms();
  const room = rooms.data?.[0];
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const move = useMoveNode(folderId);

  function toggleExpand(id: string): void {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function select(id: string): void {
    setSelectedId(id);
    // A conflict belongs to the target that caused it, not to the next one.
    move.reset();
  }

  function submit(onConflict: "fail" | "rename"): void {
    if (!selectedId) return;

    move.mutate(
      { nodeId: node.id, targetFolderId: selectedId, onConflict },
      {
        onSuccess: (moved) => {
          toast.success(
            moved.name === node.name
              ? `Moved "${moved.name}"`
              : `Moved and renamed to "${moved.name}"`,
          );
          onClose();
        },
        onError: (error) => {
          // A name clash is answered in place, with the option to keep both.
          if (error instanceof ApiError && error.status === 409) return;
          toast.error(error.message);
        },
      },
    );
  }

  const conflict =
    move.error instanceof ApiError && move.error.status === 409
      ? move.error.message
      : null;
  const otherError = move.error && !conflict ? move.error.message : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Move {node.type === "FOLDER" ? "folder" : "file"}</DialogTitle>
        <DialogDescription>
          Choose where &ldquo;{node.name}&rdquo; should go.
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-64 overflow-y-auto rounded-lg border p-1">
        {rooms.isLoading && <Skeleton className="m-1 h-7 w-40" />}
        {room && (
          <FolderTreeNode
            id={room.rootNodeId}
            name={room.name}
            depth={0}
            movedNodeId={node.id}
            currentParentId={node.parentId}
            selectedId={selectedId}
            onSelect={select}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
            insideMovedNode={false}
          />
        )}
      </div>

      {conflict && (
        <p className="text-destructive text-sm">
          {conflict} in that folder. Keep both to move it in with a numbered
          name.
        </p>
      )}
      {otherError && <p className="text-destructive text-sm">{otherError}</p>}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={move.isPending}
        >
          Cancel
        </Button>
        {conflict ? (
          <Button
            type="button"
            onClick={() => submit("rename")}
            disabled={move.isPending}
          >
            {move.isPending ? "Moving…" : "Keep both"}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => submit("fail")}
            disabled={move.isPending || selectedId === null}
          >
            {move.isPending ? "Moving…" : "Move here"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

interface FolderTreeNodeProps {
  id: string;
  name: string;
  depth: number;
  movedNodeId: string;
  currentParentId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  expandedIds: ReadonlySet<string>;
  onToggleExpand: (id: string) => void;
  /** True once an ancestor in this branch is the folder being moved. */
  insideMovedNode: boolean;
}

function FolderTreeNode({
  id,
  name,
  depth,
  movedNodeId,
  currentParentId,
  selectedId,
  onSelect,
  expandedIds,
  onToggleExpand,
  insideMovedNode,
}: FolderTreeNodeProps) {
  // The root is always open: it is the tree's entry point, and collapsing it
  // would leave the picker empty.
  const isExpanded = depth === 0 || expandedIds.has(id);
  const children = useChildren(id, { type: "FOLDER", enabled: isExpanded });
  const folders = children.data?.pages.flatMap((page) => page.items) ?? [];

  // Moving a folder into its own subtree would strand that branch, and moving
  // anything into where it already sits is a no-op.
  const isSubtree = insideMovedNode || id === movedNodeId;
  const isDisabled = isSubtree || id === currentParentId;

  return (
    <div>
      <div
        className="flex items-center gap-0.5"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <button
          type="button"
          onClick={() => onToggleExpand(id)}
          aria-label={isExpanded ? `Collapse ${name}` : `Expand ${name}`}
          aria-expanded={isExpanded}
          disabled={depth === 0}
          className="hover:bg-muted flex size-5 shrink-0 cursor-pointer items-center justify-center rounded disabled:cursor-default disabled:opacity-40"
        >
          <ChevronRightIcon
            className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")}
          />
        </button>
        <button
          type="button"
          onClick={() => onSelect(id)}
          disabled={isDisabled}
          className={cn(
            "flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-left text-sm",
            selectedId === id ? "bg-accent text-accent-foreground" : "hover:bg-muted",
            isDisabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
          )}
        >
          <FolderIcon className="size-4 shrink-0" />
          <span className="truncate">{name}</span>
        </button>
      </div>

      {isExpanded && (
        <div>
          {children.isLoading && (
            <Skeleton
              className="my-1 h-5 w-32"
              style={{ marginLeft: `${(depth + 1) * 16 + 20}px` }}
            />
          )}
          {folders.map((folder) => (
            <FolderTreeNode
              key={folder.id}
              id={folder.id}
              name={folder.name}
              depth={depth + 1}
              movedNodeId={movedNodeId}
              currentParentId={currentParentId}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              insideMovedNode={isSubtree}
            />
          ))}
          {children.hasNextPage && (
            <div style={{ paddingLeft: `${(depth + 1) * 16 + 20}px` }}>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => void children.fetchNextPage()}
                disabled={children.isFetchingNextPage}
              >
                {children.isFetchingNextPage ? "Loading…" : "Show more folders"}
              </Button>
            </div>
          )}
          {!children.isLoading && folders.length === 0 && (
            <p
              className="text-muted-foreground py-1 text-xs"
              style={{ paddingLeft: `${(depth + 1) * 16 + 20}px` }}
            >
              No subfolders
            </p>
          )}
        </div>
      )}
    </div>
  );
}
