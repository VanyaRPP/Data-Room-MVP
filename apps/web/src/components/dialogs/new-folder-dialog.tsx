"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { nodeNameSchema } from "@dataroom/shared";
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
import { useCreateFolder } from "@/hooks/use-node-mutations";

interface NewFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string;
}

export function NewFolderDialog({
  open,
  onOpenChange,
  parentId,
}: NewFolderDialogProps) {
  const [name, setName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const createFolder = useCreateFolder(parentId);

  function handleOpenChange(nextOpen: boolean): void {
    // Reset on the way out so the next open starts clean, without needing an
    // effect to watch `open`.
    if (!nextOpen) {
      setName("");
      setValidationError(null);
      createFolder.reset();
    }
    onOpenChange(nextOpen);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setValidationError(null);

    const parsed = nodeNameSchema.safeParse(name);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Invalid name");
      return;
    }

    createFolder.mutate(
      { parentId, name: parsed.data },
      {
        onSuccess: (folder) => {
          toast.success(`Created "${folder.name}"`);
          handleOpenChange(false);
        },
      },
    );
  }

  // A duplicate name comes back as a 409 and belongs next to the field that
  // caused it, not in a toast the user has to look away to read.
  const errorMessage = validationError ?? createFolder.error?.message ?? null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>
            Give the folder a name. It must be unique within this folder.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={createFolder.isPending}
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
              onClick={() => handleOpenChange(false)}
              disabled={createFolder.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createFolder.isPending}>
              {createFolder.isPending ? "Creating…" : "Create folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
