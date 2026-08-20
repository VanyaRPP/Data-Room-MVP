"use client";

import { useState } from "react";
import { ChevronDownIcon, FileTextIcon, FolderIcon } from "lucide-react";
import type { NodeDto } from "@dataroom/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useChildren } from "@/hooks/use-children";
import { usePublicChildren } from "@/hooks/use-public";

interface FolderPeekMenuProps {
  folderName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NodeDto[];
  isLoading: boolean;
  hasMore: boolean;
  onSelect: (node: NodeDto) => void;
  onOpenFolder: () => void;
}

/**
 * A peek at what a folder in the trail contains, without leaving the page.
 *
 * Presentational on purpose: the owner's view and a share view fetch the same
 * listing through different endpoints, and only the containers below differ.
 */
function FolderPeekMenu({
  folderName,
  open,
  onOpenChange,
  items,
  isLoading,
  hasMore,
  onSelect,
  onOpenFolder,
}: FolderPeekMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Show what is in ${folderName}`}
            className="hover:bg-muted hover:text-foreground flex size-4 shrink-0 cursor-pointer items-center justify-center rounded"
          />
        }
      >
        <ChevronDownIcon className="size-3" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="max-h-72 w-auto min-w-48">
        {isLoading ? (
          <div className="space-y-1.5 p-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground px-2 py-1.5 text-sm">
            This folder is empty
          </p>
        ) : (
          items.map((node) => (
            <DropdownMenuItem key={node.id} onClick={() => onSelect(node)}>
              {node.type === "FOLDER" ? (
                <FolderIcon className="text-muted-foreground" />
              ) : (
                <FileTextIcon className="text-muted-foreground" />
              )}
              <span className="max-w-56 truncate">{node.name}</span>
            </DropdownMenuItem>
          ))
        )}

        {/* Only a page is fetched, so say so rather than quietly truncating. */}
        {hasMore && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenFolder}>
              Open folder to see everything
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface PeekProps {
  folderId: string;
  folderName: string;
  onSelect: (node: NodeDto) => void;
  onOpenFolder: () => void;
}

/** The owner's view: reads the folder through the authenticated listing. */
export function FolderPeek({
  folderId,
  folderName,
  onSelect,
  onOpenFolder,
}: PeekProps) {
  const [open, setOpen] = useState(false);
  // Nothing is fetched until the menu is actually opened.
  const children = useChildren(folderId, { enabled: open });

  return (
    <FolderPeekMenu
      folderName={folderName}
      open={open}
      onOpenChange={setOpen}
      items={children.data?.pages.flatMap((page) => page.items) ?? []}
      isLoading={children.isLoading}
      hasMore={children.hasNextPage}
      onSelect={onSelect}
      onOpenFolder={onOpenFolder}
    />
  );
}

/** The share view: same menu, read through the token instead. */
export function PublicFolderPeek({
  token,
  folderId,
  folderName,
  onSelect,
  onOpenFolder,
}: PeekProps & { token: string }) {
  const [open, setOpen] = useState(false);
  const children = usePublicChildren(token, open ? folderId : undefined);

  return (
    <FolderPeekMenu
      folderName={folderName}
      open={open}
      onOpenChange={setOpen}
      items={children.data?.pages.flatMap((page) => page.items) ?? []}
      isLoading={children.isLoading}
      hasMore={children.hasNextPage}
      onSelect={onSelect}
      onOpenFolder={onOpenFolder}
    />
  );
}
