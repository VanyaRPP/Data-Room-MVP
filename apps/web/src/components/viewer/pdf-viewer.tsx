"use client";

import { useState } from "react";
import { ExternalLinkIcon, HistoryIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useFileUrl, useFileVersions } from "@/hooks/use-file-url";
import { formatBytes, formatDate } from "@/lib/format";

/**
 * The browser's own PDF renderer, pointed at a signed URL.
 *
 * An iframe rather than a JS PDF library: it costs nothing to ship, handles
 * search, zoom and printing natively, and behaves the way people already
 * expect a PDF to behave. The escape hatch below covers the browsers that
 * refuse to render PDFs inline.
 */
export function PdfViewer({ fileId, name }: { fileId: string; name: string }) {
  // undefined means "whatever is current", which also survives the file being
  // replaced while this page is open.
  const [version, setVersion] = useState<number | undefined>(undefined);
  const file = useFileUrl(fileId, version);
  const versions = useFileVersions(fileId);

  const history = versions.data ?? [];
  const viewing = version ?? history.find((entry) => entry.isCurrent)?.version;
  const isHistorical = version !== undefined && history.length > 0 && !history.find((entry) => entry.version === version)?.isCurrent;

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

      <div className="flex flex-wrap items-center gap-3">
        <a
          href={file.data.url}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ExternalLinkIcon className="size-3.5" />
          Open in new tab
        </a>

        {/* Only worth showing once there is history to show. */}
        {history.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="sm" className="gap-1.5" />}
            >
              <HistoryIcon />
              {viewing !== undefined ? `Version ${viewing}` : "Versions"}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-auto min-w-56">
              {history.map((entry) => (
                <DropdownMenuItem
                  key={entry.version}
                  onClick={() =>
                    setVersion(entry.isCurrent ? undefined : entry.version)
                  }
                >
                  <span className="flex-1">Version {entry.version}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatDate(entry.createdAt)} · {formatBytes(entry.size)}
                  </span>
                  {entry.isCurrent && <Badge variant="secondary">Current</Badge>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {isHistorical && (
          <span className="text-muted-foreground text-sm">
            Viewing an earlier version.{" "}
            <button
              type="button"
              onClick={() => setVersion(undefined)}
              className="text-foreground cursor-pointer underline underline-offset-4"
            >
              Back to current
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
