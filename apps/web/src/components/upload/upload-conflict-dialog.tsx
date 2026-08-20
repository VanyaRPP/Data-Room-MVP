"use client";

import { CopyIcon, HistoryIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resolveUploadConflict } from "@/lib/upload/upload-runner";
import { useUploadStore } from "@/lib/upload/upload-store";

/**
 * Asked once per batch, before anything is uploaded.
 *
 * Neither answer is obviously right - replacing a document during due
 * diligence is normal, and so is receiving a second copy from a different
 * party - so the choice belongs to the person who knows which happened.
 */
export function UploadConflictDialog() {
  const queryClient = useQueryClient();
  const pending = useUploadStore((state) => state.pendingConflict);

  const count = pending?.taken.length ?? 0;

  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) resolveUploadConflict("cancel", queryClient);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {count === 1
              ? "This file already exists here"
              : `${count} of these files already exist here`}
          </DialogTitle>
          <DialogDescription>
            {pending?.taken.slice(0, 3).join(", ")}
            {count > 3 && ` and ${count - 3} more`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Upload as new versions</span> replaces
            what is there and keeps the old copies in the file&rsquo;s history.
          </p>
          <p>
            <span className="font-medium">Keep both</span> uploads alongside,
            with a number added to the name.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => resolveUploadConflict("rename", queryClient)}
          >
            <CopyIcon />
            Keep both
          </Button>
          <Button onClick={() => resolveUploadConflict("version", queryClient)}>
            <HistoryIcon />
            Upload as new {count === 1 ? "version" : "versions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
