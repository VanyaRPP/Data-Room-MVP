"use client";

import { useRef } from "react";
import { UploadIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PDF_MIME_TYPE } from "@dataroom/shared";
import { Button } from "@/components/ui/button";
import { startUploads } from "@/lib/upload/upload-runner";

export function UploadButton({
  folderId,
  variant = "default",
  /** Off in the toolbar, where the label folds away on a narrow screen. */
  alwaysLabelled = true,
}: {
  folderId: string;
  variant?: "default" | "outline";
  alwaysLabelled?: boolean;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button size="sm" variant={variant} onClick={() => inputRef.current?.click()}>
        <UploadIcon />
        <span className={alwaysLabelled ? undefined : "sr-only sm:not-sr-only"}>
          Upload
        </span>
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={PDF_MIME_TYPE}
        className="hidden"
        onChange={(event) => {
          startUploads(
            Array.from(event.target.files ?? []),
            folderId,
            queryClient,
          );
          // Reset so picking the same file twice in a row still fires onChange.
          event.target.value = "";
        }}
      />
    </>
  );
}
