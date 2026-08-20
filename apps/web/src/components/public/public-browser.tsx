"use client";

import { useRouter } from "next/navigation";
import { FolderIcon } from "lucide-react";
import type { PublicShareDto } from "@dataroom/shared";
import { EmptyState } from "@/components/browser/empty-state";
import { FileBrowser } from "@/components/browser/file-browser";
import { PublicFolderPeek } from "@/components/browser/folder-peek";
import { PathBreadcrumbs } from "@/components/browser/path-breadcrumbs";
import { ShareGoneScreen } from "@/components/public/share-gone-screen";
import { isGone, usePublicBreadcrumbs, usePublicChildren } from "@/hooks/use-public";

interface PublicBrowserProps {
  share: PublicShareDto;
  /** The folder being viewed; the share root unless the visitor navigated in. */
  folderId: string;
}

/**
 * The read-only counterpart of RoomBrowser, built from the same FileBrowser.
 *
 * It passes no row actions at all, so the mutation menus are absent rather than
 * disabled - a greyed-out "Delete" would still advertise something this view
 * will never offer.
 */
export function PublicBrowser({ share, folderId }: PublicBrowserProps) {
  const router = useRouter();
  const children = usePublicChildren(share.token, folderId);
  const breadcrumbs = usePublicBreadcrumbs(share.token, folderId);

  if (isGone(children.error) || isGone(breadcrumbs.error)) {
    return <ShareGoneScreen />;
  }

  const items = children.data?.pages.flatMap((page) => page.items) ?? [];

  // The trail already stops at the shared folder, so "up" can never climb out
  // of the share and into the owner's room.
  const trail = breadcrumbs.data;
  const parent = trail && trail.length >= 2 ? trail[trail.length - 2] : null;

  const openFolder = (nodeId: string): void => {
    router.push(
      nodeId === share.root.id
        ? `/s/${share.token}`
        : `/s/${share.token}/folder/${nodeId}`,
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      <div className="mb-4">
        <PathBreadcrumbs
          items={breadcrumbs.data}
          isLoading={breadcrumbs.isLoading}
          onNavigate={openFolder}
          renderPeek={(folder) => (
            <PublicFolderPeek
              token={share.token}
              folderId={folder.id}
              folderName={folder.name}
              onSelect={(node) =>
                node.type === "FOLDER"
                  ? openFolder(node.id)
                  : router.push(`/s/${share.token}/file/${node.id}`)
              }
              onOpenFolder={() => openFolder(folder.id)}
            />
          )}
        />
      </div>

      <div className="rounded-xl border">
        <FileBrowser
          items={items}
          isLoading={children.isLoading}
          error={children.error}
          onRetry={() => void children.refetch()}
          onOpenFolder={(node) => openFolder(node.id)}
          onOpenFile={(node) => router.push(`/s/${share.token}/file/${node.id}`)}
          // No onDrop: a shared view can navigate up, never move anything.
          parentFolder={
            parent
              ? {
                  id: parent.id,
                  name: parent.name,
                  onOpen: () => openFolder(parent.id),
                }
              : null
          }
          hasNextPage={children.hasNextPage}
          isFetchingNextPage={children.isFetchingNextPage}
          onLoadMore={() => void children.fetchNextPage()}
          emptyState={
            <EmptyState
              icon={<FolderIcon />}
              title="This folder is empty"
              description="There is nothing shared in here yet."
            />
          }
        />
      </div>
    </div>
  );
}
