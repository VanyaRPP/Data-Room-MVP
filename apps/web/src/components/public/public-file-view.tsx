"use client";

import { useRouter } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";
import type { PublicShareDto } from "@dataroom/shared";
import { PublicFolderPeek } from "@/components/browser/folder-peek";
import { PathBreadcrumbs } from "@/components/browser/path-breadcrumbs";
import { ShareGoneScreen } from "@/components/public/share-gone-screen";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DownloadButton } from "@/components/viewer/download-button";
import {
  isGone,
  usePublicBreadcrumbs,
  usePublicFileUrl,
} from "@/hooks/use-public";
import { downloadPath } from "@/lib/download";

export function PublicFileView({
  share,
  fileId,
}: {
  share: PublicShareDto;
  fileId: string;
}) {
  const router = useRouter();
  const breadcrumbs = usePublicBreadcrumbs(share.token, fileId);
  const file = usePublicFileUrl(share.token, fileId);

  if (isGone(file.error) || isGone(breadcrumbs.error)) {
    return <ShareGoneScreen />;
  }

  const trail = breadcrumbs.data;
  const name = trail?.[trail.length - 1]?.name ?? "";

  const openFolder = (nodeId: string): void => {
    router.push(
      nodeId === share.root.id
        ? `/s/${share.token}`
        : `/s/${share.token}/folder/${nodeId}`,
    );
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-3.25rem)] w-full max-w-5xl flex-col gap-4 px-6 py-6">
      <PathBreadcrumbs
        items={trail}
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

      <div className="min-h-0 flex-1">
        {file.isError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border text-center">
            <div className="space-y-1">
              <p className="font-medium">Could not open this file</p>
              <p className="text-muted-foreground text-sm">
                {file.error.message}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void file.refetch()}>
              Try again
            </Button>
          </div>
        ) : !file.data ? (
          <Skeleton className="h-full w-full rounded-xl" />
        ) : (
          <div className="flex h-full flex-col gap-2">
            <iframe
              src={file.data.url}
              title={name}
              className="bg-muted h-full w-full rounded-xl border"
            />
            <div className="flex items-center gap-3">
              <a
                href={file.data.url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
              >
                <ExternalLinkIcon className="size-3.5" />
                Open in new tab
              </a>
              {/* Read-only is about what a visitor may change. A document sent
                  out for review is meant to be read, and every browser's PDF
                  viewer has a save button of its own anyway. */}
              <DownloadButton
                urlPath={downloadPath.shared(share.token, fileId)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
