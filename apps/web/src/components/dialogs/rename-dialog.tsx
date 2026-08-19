"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { nodeNameSchema, type NodeDto } from "@dataroom/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRenameNode } from "@/hooks/use-node-mutations";

interface RenameDialogProps {
  node: NodeDto | null;
  folderId: string;
  onOpenChange: (open: boolean) => void;
}

export function RenameDialog({
  node,
  folderId,
  onOpenChange,
}: RenameDialogProps) {
  return (
    <Dialog open={node !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {node && (
          // Keyed by node so switching targets always starts from that node's
          // own name rather than whatever was typed last time.
          <RenameDialogBody
            key={node.id}
            node={node}
            folderId={folderId}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RenameDialogBody({
  node,
  folderId,
  onClose,
}: {
  node: NodeDto;
  folderId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(node.name);
  const [validationError, setValidationError] = useState<string | null>(null);
  const rename = useRenameNode(folderId);

  const label = node.type === "FOLDER" ? "folder" : "file";

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setValidationError(null);

    const parsed = nodeNameSchema.safeParse(name);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Invalid name");
      return;
    }

    if (parsed.data === node.name) {
      onClose();
      return;
    }

    rename.mutate(
      { nodeId: node.id, name: parsed.data },
      {
        onSuccess: (updated) => {
          toast.success(`Renamed to "${updated.name}"`);
          onClose();
        },
      },
    );
  }

  const errorMessage = validationError ?? rename.error?.message ?? null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Rename {label}</DialogTitle>
        <DialogDescription>
          Choose a new name for &ldquo;{node.name}&rdquo;.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="rename-name">Name</Label>
          <Input
            id="rename-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={rename.isPending}
            aria-invalid={errorMessage !== null}
            autoFocus
          />
          {errorMessage && (
            <p className="text-destructive text-sm">{errorMessage}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={rename.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={rename.isPending}>
            {rename.isPending ? "Renaming…" : "Rename"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
