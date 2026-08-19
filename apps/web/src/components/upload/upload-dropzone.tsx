"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { UploadCloudIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { startUploads } from "@/lib/upload/upload-runner";

interface UploadDropzoneProps {
  folderId: string;
  children: ReactNode;
}

export function UploadDropzone({ folderId, children }: UploadDropzoneProps) {
  const queryClient = useQueryClient();
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  // dragenter/dragleave fire for every child element the pointer crosses.
  // Counting them is what keeps the overlay from flickering on the way in.
  const dragDepth = useRef(0);

  function handleDragEnter(event: DragEvent<HTMLDivElement>): void {
    if (!event.dataTransfer.types.includes("Files")) return;
    dragDepth.current += 1;
    setIsDraggingOver(true);
  }

  function handleDragLeave(): void {
    dragDepth.current = Math.max(dragDepth.current - 1, 0);
    if (dragDepth.current === 0) setIsDraggingOver(false);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>): void {
    if (!event.dataTransfer.types.includes("Files")) return;
    // Without this the browser navigates to the dropped file instead.
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDraggingOver(false);
    startUploads(Array.from(event.dataTransfer.files), folderId, queryClient);
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative"
    >
      {children}

      {isDraggingOver && (
        <div className="bg-background/80 border-primary pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed backdrop-blur-[1px]">
          <UploadCloudIcon className="text-primary size-7" />
          <p className="font-medium">Drop PDF files to upload</p>
        </div>
      )}
    </div>
  );
}
