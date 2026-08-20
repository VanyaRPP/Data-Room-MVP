"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { requestDownload } from "@/lib/download";

/**
 * Saves the file on screen. `urlPath` differs between the owner's view and a
 * share link, which resolves files through its token instead.
 */
export function DownloadButton({ urlPath }: { urlPath: string }) {
  const [isPreparing, setIsPreparing] = useState(false);

  async function handleClick(): Promise<void> {
    setIsPreparing(true);
    try {
      await requestDownload(urlPath);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not download the file",
      );
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5"
      onClick={() => void handleClick()}
      disabled={isPreparing}
    >
      <DownloadIcon />
      {isPreparing ? "Preparing…" : "Download"}
    </Button>
  );
}
