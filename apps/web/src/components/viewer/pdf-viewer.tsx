"use client";

import { ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFileUrl } from "@/hooks/use-file-url";

/**
 * The browser's own PDF renderer, pointed at a signed URL.
 *
 * An iframe rather than a JS PDF library: it costs nothing to ship, handles
 * search, zoom and printing natively, and behaves the way people already
 * expect a PDF to behave. The escape hatch below covers the browsers that
 * refuse to render PDFs inline.
 */
export function PdfViewer({ fileId, name }: { fileId: string; name: string }) {
  const file = useFileUrl(fileId);

  if (file.isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border text-center">
        <div className="space-y-1">
          <p className="font-medium">Could not open this file</p>
          <p className="text-muted-foreground text-sm">{file.error.message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void file.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!file.data) {
    return <Skeleton className="h-full w-full rounded-xl" />;
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <iframe
        src={file.data.url}
        title={name}
        className="bg-muted h-full w-full rounded-xl border"
      />
      <a
        href={file.data.url}
        target="_blank"
        rel="noreferrer"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 self-start text-sm"
      >
        <ExternalLinkIcon className="size-3.5" />
        Open in new tab
      </a>
    </div>
  );
}
