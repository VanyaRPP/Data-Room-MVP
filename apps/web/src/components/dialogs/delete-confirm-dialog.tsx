"use client";

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
import { useDeleteNode } from "@/hooks/use-node-mutations";
import { useDeletePreview } from "@/hooks/use-delete-preview";
import { formatBytes } from "@/lib/format";

interface DeleteConfirmDialogProps {
  node: NodeDto | null;
  folderId: string;
  onOpenChange: (open: boolean) => void;
}

export function DeleteConfirmDialog({
  node,
  folderId,
  onOpenChange,
}: DeleteConfirmDialogProps) {
  const preview = useDeletePreview(node?.id ?? null);
  const deleteNode = useDeleteNode(folderId);

  function handleDelete(): void {
    if (!node) return;

    deleteNode.mutate(node.id, {
      onSuccess: () => {
        toast.success(`Deleted "${node.name}"`);
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(error.message);
        onOpenChange(false);
      },
    });
  }

  return (
    <AlertDialog open={node !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            Delete {node?.type === "FOLDER" ? "folder" : "file"}?
          </AlertDialogTitle>
          <AlertDialogDescription
            render={
              <div className="space-y-2">
                {preview.isLoading ? (
                  <Skeleton className="h-4 w-64" />
                ) : (
                  <p>{node && describeDeletion(node, preview.data)}</p>
                )}
                <p className="text-foreground font-medium">
                  This can&rsquo;t be undone.
                </p>
              </div>
            }
          />
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteNode.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            // Waiting on the preview keeps anyone from confirming before they
            // can see how much the delete would take with it.
            disabled={deleteNode.isPending || preview.isLoading}
          >
            {deleteNode.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * The preview counts the node itself, so a folder's own entry is subtracted to
 * describe what it *contains*.
 */
function describeDeletion(
  node: NodeDto,
  preview: DeletePreviewDto | undefined,
): string {
  if (!preview) {
    return `This will permanently delete “${node.name}”.`;
  }

  if (node.type === "FILE") {
    return `This will permanently delete “${node.name}” (${formatBytes(preview.totalSize)}).`;
  }

  const nestedFolders = Math.max(preview.folders - 1, 0);
  if (nestedFolders === 0 && preview.files === 0) {
    return `This will permanently delete the empty folder “${node.name}”.`;
  }

  const contents = [
    nestedFolders > 0 && pluralize(nestedFolders, "folder"),
    preview.files > 0 && pluralize(preview.files, "file"),
  ].filter((part): part is string => part !== false);

  // Only worth a byte count when there is actually something taking up space.
  const size = preview.files > 0 ? ` (${formatBytes(preview.totalSize)})` : "";

  return `This will permanently delete “${node.name}” and everything inside it: ${contents.join(" and ")}${size}.`;
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
