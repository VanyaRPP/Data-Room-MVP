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
import {
  FileBrowser,
  type FolderTarget,
} from "@/components/browser/file-browser";
import { PathBreadcrumbs } from "@/components/browser/path-breadcrumbs";
import { DeleteConfirmDialog } from "@/components/dialogs/delete-confirm-dialog";
import { MoveDialog } from "@/components/dialogs/move-dialog";
import { NewFolderDialog } from "@/components/dialogs/new-folder-dialog";
import { RenameDialog } from "@/components/dialogs/rename-dialog";
import { ShareDialog } from "@/components/dialogs/share-dialog";
import { UploadButton } from "@/components/upload/upload-button";
import { UploadDropzone } from "@/components/upload/upload-dropzone";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { useChildren } from "@/hooks/use-children";
import { useMoveNode } from "@/hooks/use-node-mutations";
import { useRooms } from "@/hooks/use-rooms";
import { ApiError } from "@/lib/api";

export function RoomBrowser({ folderId }: { folderId: string }) {
  const router = useRouter();
  const children = useChildren(folderId);
  const breadcrumbs = useBreadcrumbs(folderId);
  const rooms = useRooms();

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<NodeDto | null>(null);
  const [moveTarget, setMoveTarget] = useState<NodeDto | null>(null);
  const [shareTarget, setShareTarget] = useState<NodeDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NodeDto | null>(null);

  const moveByDrag = useMoveNode(folderId);
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

  // Second from the end of the trail: the folder containing this one. Absent
  // at the room root, which has nowhere to go up to.
  const trail = breadcrumbs.data;
  const parent = trail && trail.length >= 2 ? trail[trail.length - 2] : null;

  /**
   * Dropping a row onto a folder row moves it there.
   *
   * A name clash cannot open a dialog here without throwing away the gesture
   * the user just made, so the offer to keep both rides along on the toast.
   */
  function handleDragMove(node: NodeDto, target: FolderTarget): void {
    const run = (onConflict: "fail" | "rename"): void => {
      moveByDrag.mutate(
        { nodeId: node.id, targetFolderId: target.id, onConflict },
        {
          onSuccess: (moved) => {
            toast.success(
              moved.name === node.name
                ? `Moved "${moved.name}" to "${target.name}"`
                : `Moved to "${target.name}" as "${moved.name}"`,
            );
          },
          onError: (error) => {
            if (error instanceof ApiError && error.status === 409) {
              toast.error(`"${node.name}" already exists in "${target.name}"`, {
                action: { label: "Keep both", onClick: () => run("rename") },
              });
              return;
            }
            toast.error(error.message);
          },
        },
      );
    };

    run("fail");
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <PathBreadcrumbs
          items={breadcrumbs.data}
          isLoading={breadcrumbs.isLoading}
          onNavigate={(nodeId) => router.push(`/room/${nodeId}`)}
        />
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setNewFolderOpen(true)}>
            <FolderPlusIcon />
            New folder
          </Button>
          <UploadButton folderId={folderId} />
        </div>
      </div>

      <UploadDropzone folderId={folderId}>
        <div className="rounded-xl border">
          <FileBrowser
            items={items}
            isLoading={children.isLoading}
            error={children.error}
            onRetry={() => void children.refetch()}
            onOpenFolder={(node) => router.push(`/room/${node.id}`)}
            onOpenFile={(node) => router.push(`/file/${node.id}`)}
            hasNextPage={children.hasNextPage}
            isFetchingNextPage={children.isFetchingNextPage}
            onLoadMore={() => void children.fetchNextPage()}
            onMoveNode={handleDragMove}
            parentFolder={
              parent
                ? {
                    id: parent.id,
                    name: parent.name,
                    onOpen: () => router.push(`/room/${parent.id}`),
                    onDrop: (node) => handleDragMove(node, parent),
                  }
                : null
            }
            emptyState={
              <EmptyState
                icon={<FolderIcon />}
                title="This folder is empty"
                description="Drop PDF files here to upload them, or create a folder."
                action={
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNewFolderOpen(true)}
                    >
                      <FolderPlusIcon />
                      New folder
                    </Button>
                    <UploadButton folderId={folderId} />
                  </div>
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
                  <DropdownMenuItem onClick={() => setMoveTarget(node)}>
                    Move
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShareTarget(node)}>
                    Share
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
      </UploadDropzone>

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
      <MoveDialog
        node={moveTarget}
        folderId={folderId}
        onOpenChange={(open) => {
          if (!open) setMoveTarget(null);
        }}
      />
      <ShareDialog
        node={shareTarget}
        onOpenChange={(open) => {
          if (!open) setShareTarget(null);
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
