"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { nodeNameSchema, type RoomDto } from "@dataroom/shared";
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
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

interface RenameRoomDialogProps {
  room: RoomDto | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Renames the data room.
 *
 * Distinct from renaming a folder: the room's root folder is structural and
 * refuses a rename, but the room around it is what everybody calls the thing -
 * and "My Data Room" is nobody's name for an acquisition.
 */
export function RenameRoomDialog({ room, onOpenChange }: RenameRoomDialogProps) {
  return (
    <Dialog open={room !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {room && (
          <RenameRoomBody
            key={room.id}
            room={room}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RenameRoomBody({
  room,
  onClose,
}: {
  room: RoomDto;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(room.name);
  const [validationError, setValidationError] = useState<string | null>(null);

  const rename = useMutation({
    mutationFn: (newName: string) =>
      apiFetch<RoomDto>(`/rooms/${room.id}`, {
        method: "PATCH",
        body: { name: newName },
      }),
    onSuccess: (updated) => {
      // The name reaches the screen two ways: the move picker reads it from
      // the room list, and every breadcrumb trail reads it from the root node
      // the server renamed alongside it.
      void queryClient.invalidateQueries({ queryKey: queryKeys.rooms });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.allBreadcrumbs,
      });
      toast.success(`Renamed to “${updated.name}”`);
      onClose();
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setValidationError(null);

    const parsed = nodeNameSchema.safeParse(name);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Invalid name");
      return;
    }

    if (parsed.data === room.name) {
      onClose();
      return;
    }

    rename.mutate(parsed.data);
  }

  const errorMessage = validationError ?? rename.error?.message ?? null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Rename data room</DialogTitle>
        <DialogDescription>
          This is the name at the start of every trail, and the one people see
          on anything you share.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="room-name">Name</Label>
          <Input
            id="room-name"
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
