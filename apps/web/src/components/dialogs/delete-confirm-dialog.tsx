"use client";

import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { DeletePreviewDto, NodeDto } from "@dataroom/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteNodes } from "@/hooks/use-node-mutations";
import { useDeletePreview } from "@/hooks/use-delete-preview";
import { formatBytes } from "@/lib/format";

interface DeleteConfirmDialogProps {
  /** What is about to be deleted. Empty closes the dialog. */
  nodes: NodeDto[];
  folderId: string;
  onOpenChange: (open: boolean) => void;
}

export function DeleteConfirmDialog({
  nodes,
  folderId,
  onOpenChange,
}: DeleteConfirmDialogProps) {
  // The dialog fades out rather than vanishing, so it keeps rendering the
  // selection it was opened with: reading the live one would empty the text
  // and collapse the box mid-animation.
  const [shown, setShown] = useState(nodes);
  if (nodes.length > 0 && !sameNodes(nodes, shown)) setShown(nodes);

  const preview = useDeletePreview(nodes.map((node) => node.id));
  const deleteNodes = useDeleteNodes(folderId);

  function handleDelete(): void {
    if (nodes.length === 0) return;

    deleteNodes.mutate(
      nodes.map((node) => node.id),
      {
        onSuccess: () => {
          const [only] = nodes;
          toast.success(
            nodes.length === 1 && only
              ? `Deleted “${only.name}”`
              : `Deleted ${nodes.length} items`,
          );
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(error.message);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <AlertDialog open={nodes.length > 0} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>{deleteTitle(shown)}</AlertDialogTitle>
          <AlertDialogDescription
            render={
              <div className="space-y-2">
                {preview.isLoading ? (
                  <Skeleton className="h-4 w-64" />
                ) : (
                  <p>{describeDeletion(shown, preview.data)}</p>
                )}
                <p className="text-foreground font-medium">
                  This can&rsquo;t be undone.
                </p>
              </div>
            }
          />
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteNodes.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            // Waiting on the preview keeps anyone from confirming before they
            // can see how much the delete would take with it.
            disabled={deleteNodes.isPending || preview.isLoading}
          >
            {deleteNodes.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function sameNodes(a: NodeDto[], b: NodeDto[]): boolean {
  return a.length === b.length && a.every((node, index) => node === b[index]);
}

function deleteTitle(nodes: NodeDto[]): string {
  const [only] = nodes;
  if (nodes.length === 1 && only) {
    return only.type === "FOLDER" ? "Delete folder?" : "Delete file?";
  }
  return `Delete ${nodes.length} items?`;
}

/**
 * What is about to be destroyed, in numbers rather than a vague warning.
 *
 * The preview counts the selected nodes themselves, so they are subtracted to
 * describe what they *contain* - otherwise deleting one empty folder would
 * report that it holds a folder.
 */
function describeDeletion(
  nodes: NodeDto[],
  preview: DeletePreviewDto | undefined,
): string {
  const [only] = nodes;
  if (!preview) {
    return `This will permanently delete ${
      nodes.length === 1 && only ? `“${only.name}”` : `${nodes.length} items`
    }.`;
  }

  const selectedFolders = nodes.filter(
    (node) => node.type === "FOLDER",
  ).length;
  const nestedFolders = Math.max(preview.folders - selectedFolders, 0);
  const nestedFiles = Math.max(
    preview.files - (nodes.length - selectedFolders),
    0,
  );
  // Only worth a byte count when there is actually something taking up space.
  const size = preview.files > 0 ? ` (${formatBytes(preview.totalSize)})` : "";
  const inside = describeCounts(nestedFolders, nestedFiles);

  if (nodes.length === 1 && only) {
    if (only.type === "FILE") {
      return `This will permanently delete “${only.name}”${size}.`;
    }
    if (inside === null) {
      return `This will permanently delete the empty folder “${only.name}”.`;
    }
    return `This will permanently delete “${only.name}” and everything inside it: ${inside}${size}.`;
  }

  const selected =
    describeCounts(selectedFolders, nodes.length - selectedFolders) ??
    `${nodes.length} items`;

  return inside === null
    ? `This will permanently delete ${selected}${size}.`
    : `This will permanently delete ${selected}, along with the ${inside} inside them${size}.`;
}

/** `2 folders and 9 files`, dropping either half at zero. Null when both are. */
function describeCounts(folders: number, files: number): string | null {
  const parts = [
    folders > 0 && pluralize(folders, "folder"),
    files > 0 && pluralize(files, "file"),
  ].filter((part): part is string => part !== false);

  return parts.length === 0 ? null : parts.join(" and ");
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
