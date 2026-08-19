"use client";

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  XIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { retryUpload } from "@/lib/upload/upload-runner";
import {
  isFinished,
  useUploadStore,
  type UploadItem,
} from "@/lib/upload/upload-store";
import { cn } from "@/lib/utils";

/**
 * Lives in the app shell rather than any folder page: uploads keep running
 * while the user navigates, and the panel has to keep reporting on them.
 */
export function UploadQueuePanel() {
  const queryClient = useQueryClient();
  const items = useUploadStore((state) => state.items);
  const isCollapsed = useUploadStore((state) => state.isCollapsed);
  const setCollapsed = useUploadStore((state) => state.setCollapsed);
  const clearAll = useUploadStore((state) => state.clearAll);

  if (items.length === 0) return null;

  const inProgress = items.filter((item) => !isFinished(item.status)).length;
  const failed = items.filter((item) => item.status === "error").length;

  return (
    <div className="bg-popover fixed right-4 bottom-4 z-40 w-80 overflow-hidden rounded-xl border shadow-lg">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <p className="truncate text-sm font-medium">{summarize(inProgress, failed, items.length)}</p>
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? "Expand uploads" : "Collapse uploads"}
            aria-expanded={!isCollapsed}
          >
            <ChevronDownIcon
              className={cn("transition-transform", isCollapsed && "rotate-180")}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={clearAll}
            // Uploads already in flight are not cancelled by dismissing the
            // panel; they simply finish without being reported.
            disabled={inProgress > 0}
            aria-label="Dismiss uploads"
          >
            <XIcon />
          </Button>
        </div>
      </div>

      {!isCollapsed && (
        <ul className="max-h-64 divide-y overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="px-3 py-2">
              <UploadRow
                item={item}
                onRetry={() => retryUpload(item.id, queryClient)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UploadRow({
  item,
  onRetry,
}: {
  item: UploadItem;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {item.status === "done" && (
          <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" />
        )}
        {item.status === "error" && (
          <AlertCircleIcon className="text-destructive size-4 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm" title={item.name}>
          {item.name}
        </span>
        {item.status === "uploading" && (
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {item.progress}%
          </span>
        )}
        {item.status === "error" && item.canRetry && (
          <Button variant="ghost" size="xs" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>

      {item.status === "uploading" && <Progress value={item.progress} />}

      {item.error ? (
        <p className="text-destructive text-xs">{item.error}</p>
      ) : (
        item.status !== "uploading" &&
        item.status !== "done" && (
          <p className="text-muted-foreground text-xs">
            {item.status === "completing" ? "Finishing…" : "Waiting…"}
          </p>
        )
      )}
    </div>
  );
}

function summarize(inProgress: number, failed: number, total: number): string {
  if (inProgress > 0) {
    return `Uploading ${inProgress} of ${total} file${total === 1 ? "" : "s"}`;
  }
  if (failed > 0) {
    return `${failed} upload${failed === 1 ? "" : "s"} failed`;
  }
  return `Uploaded ${total} file${total === 1 ? "" : "s"}`;
}
