"use client";

import type { ReactNode } from "react";
import { FileTextIcon, FolderIcon } from "lucide-react";
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
}

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
}: FileBrowserProps) {
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
          {items.map((node) => (
            <TableRow key={node.id}>
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
