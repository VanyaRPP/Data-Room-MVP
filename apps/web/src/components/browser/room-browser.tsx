"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderIcon, FolderPlusIcon, MoreHorizontalIcon } from "lucide-react";
import { toast } from "sonner";
import type { NodeDto } from "@dataroom/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/browser/empty-state";
import { FileBrowser } from "@/components/browser/file-browser";
import { PathBreadcrumbs } from "@/components/browser/path-breadcrumbs";
import { DeleteConfirmDialog } from "@/components/dialogs/delete-confirm-dialog";
import { NewFolderDialog } from "@/components/dialogs/new-folder-dialog";
import { RenameDialog } from "@/components/dialogs/rename-dialog";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { useChildren } from "@/hooks/use-children";
import { useRooms } from "@/hooks/use-rooms";
import { ApiError } from "@/lib/api";

export function RoomBrowser({ folderId }: { folderId: string }) {
  const router = useRouter();
  const children = useChildren(folderId);
  const breadcrumbs = useBreadcrumbs(folderId);
  const rooms = useRooms();

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<NodeDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NodeDto | null>(null);

  const rootId = rooms.data?.[0]?.rootNodeId ?? null;
  const childrenError = children.error;

  // The folder can disappear while it is open - deleted from another tab, or
  // in another session. The listing answers 404, and the only sensible place
  // left to be is the room's root.
  useEffect(() => {
    const isMissing =
      childrenError instanceof ApiError && childrenError.status === 404;

    if (isMissing && rootId && rootId !== folderId) {
      toast.error("That folder no longer exists");
      router.replace(`/room/${rootId}`);
    }
  }, [childrenError, rootId, folderId, router]);

  const items = children.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <PathBreadcrumbs
          items={breadcrumbs.data}
          isLoading={breadcrumbs.isLoading}
          onNavigate={(nodeId) => router.push(`/room/${nodeId}`)}
        />
        <Button size="sm" onClick={() => setNewFolderOpen(true)}>
          <FolderPlusIcon />
          New folder
        </Button>
      </div>

      <div className="rounded-xl border">
        <FileBrowser
          items={items}
          isLoading={children.isLoading}
          error={children.error}
          onRetry={() => void children.refetch()}
          onOpenFolder={(node) => router.push(`/room/${node.id}`)}
          hasNextPage={children.hasNextPage}
          isFetchingNextPage={children.isFetchingNextPage}
          onLoadMore={() => void children.fetchNextPage()}
          emptyState={
            <EmptyState
              icon={<FolderIcon />}
              title="This folder is empty"
              description="Create a folder to start organising this data room."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewFolderOpen(true)}
                >
                  <FolderPlusIcon />
                  New folder
                </Button>
              }
            />
          }
          renderRowActions={(node) => (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Actions for ${node.name}`}
                  />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto min-w-32">
                <DropdownMenuItem onClick={() => setRenameTarget(node)}>
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteTarget(node)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />
      </div>

      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        parentId={folderId}
      />
      <RenameDialog
        node={renameTarget}
        folderId={folderId}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      />
      <DeleteConfirmDialog
        node={deleteTarget}
        folderId={folderId}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
