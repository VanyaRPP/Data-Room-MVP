import type { QueryClient } from "@tanstack/react-query";
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_BATCH,
  PDF_MIME_TYPE,
  type NodeDto,
  type PresignedFileDto,
  type UploadConflictStrategy,
  type UploadConflictsDto,
} from "@dataroom/shared";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useUploadStore, type UploadItem } from "./upload-store";
import { putFile } from "./xhr";

/**
 * Browsers cap connections per host anyway; keeping the queue narrower than
 * that leaves room for the app's own API calls while a big batch uploads.
 */
const MAX_CONCURRENT_UPLOADS = 3;

let activeUploads = 0;
const waiting: (() => void)[] = [];

async function acquireSlot(): Promise<void> {
  // A loop, not a single await: several waiters can be released at once, and
  // each must re-check rather than assume the slot is still free.
  while (activeUploads >= MAX_CONCURRENT_UPLOADS) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  activeUploads += 1;
}

function releaseSlot(): void {
  activeUploads -= 1;
  waiting.shift()?.();
}

/** The client-side half of the rules the API enforces server-side. */
function rejectionReason(file: File): string | null {
  // Some systems report no type at all for a dragged file; the extension is
  // the only signal left, and the server checks what actually gets stored.
  const looksLikePdf =
    file.type === PDF_MIME_TYPE ||
    (file.type === "" && file.name.toLowerCase().endsWith(".pdf"));

  if (!looksLikePdf) return "Only PDF files can be uploaded";
  if (file.size === 0) return "This file is empty";
  if (file.size > MAX_FILE_SIZE_BYTES) return "Files must be 50 MB or smaller";
  return null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Upload failed";
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * Queues files for upload. Invalid ones still enter the queue, as errors with
 * a reason - silently dropping them would leave the user wondering which of
 * the files they picked actually went.
 */
export function startUploads(
  files: File[],
  folderId: string,
  queryClient: QueryClient,
): void {
  if (files.length === 0) return;

  const items: UploadItem[] = files.map((file) => {
    const reason = rejectionReason(file);
    return {
      id: crypto.randomUUID(),
      name: file.name,
      file,
      folderId,
      status: reason ? "error" : "pending",
      progress: 0,
      error: reason,
      canRetry: reason === null,
    };
  });

  useUploadStore.getState().add(items);

  const accepted = items.filter((item) => item.status === "pending");
  if (accepted.length === 0) return;

  void beginAccepted(accepted, folderId, queryClient);
}

/**
 * Asks the server whether any of these names is already taken before a byte
 * moves. If so the batch waits for the user to choose; otherwise it goes
 * straight out, suffixing around any clash that appears in the meantime.
 */
async function beginAccepted(
  accepted: UploadItem[],
  folderId: string,
  queryClient: QueryClient,
): Promise<void> {
  let taken: string[] = [];
  try {
    const response = await apiFetch<UploadConflictsDto>("/files/conflicts", {
      method: "POST",
      body: { folderId, names: accepted.map((item) => item.file.name) },
    });
    taken = response.taken;
  } catch {
    // The check is a courtesy, not a gate: if it fails, fall back to the
    // behaviour that never loses anything - keep both.
  }

  if (taken.length > 0) {
    useUploadStore.getState().setPendingConflict({
      itemIds: accepted.map((item) => item.id),
      folderId,
      taken,
    });
    return;
  }

  dispatch(accepted, folderId, "rename", queryClient);
}

/** Applies the user's answer to the batch that was waiting on it. */
export function resolveUploadConflict(
  choice: UploadConflictStrategy | "cancel",
  queryClient: QueryClient,
): void {
  const store = useUploadStore.getState();
  const pending = store.pendingConflict;
  if (!pending) return;

  store.setPendingConflict(null);
  const waiting = store.items.filter((item) =>
    pending.itemIds.includes(item.id),
  );

  if (choice === "cancel") {
    store.remove(pending.itemIds);
    return;
  }

  dispatch(waiting, pending.folderId, choice, queryClient);
}

function dispatch(
  items: UploadItem[],
  folderId: string,
  onConflict: UploadConflictStrategy,
  queryClient: QueryClient,
): void {
  for (const batch of chunk(items, MAX_FILES_PER_BATCH)) {
    void processBatch(batch, folderId, onConflict, queryClient);
  }
}

/** Retrying always re-presigns: an upload URL is good for one attempt. */
export function retryUpload(itemId: string, queryClient: QueryClient): void {
  const store = useUploadStore.getState();
  const item = store.items.find((candidate) => candidate.id === itemId);
  if (!item?.canRetry) return;

  store.update(itemId, { status: "pending", progress: 0, error: null });
  void processBatch([item], item.folderId, "rename", queryClient);
}

async function processBatch(
  items: UploadItem[],
  folderId: string,
  onConflict: UploadConflictStrategy,
  queryClient: QueryClient,
): Promise<void> {
  if (items.length === 0) return;

  const { update } = useUploadStore.getState();
  for (const item of items) update(item.id, { status: "presigning" });

  let slots: PresignedFileDto[];
  try {
    slots = await apiFetch<PresignedFileDto[]>("/files/presign", {
      method: "POST",
      body: {
        folderId,
        onConflict,
        files: items.map((item) => ({
          name: item.file.name,
          size: item.file.size,
          mimeType: PDF_MIME_TYPE,
        })),
      },
    });
  } catch (error) {
    const message = errorMessage(error);
    for (const item of items) {
      update(item.id, { status: "error", error: message });
    }
    return;
  }

  // The server answers in request order, so index pairs each file with its slot.
  await Promise.all(
    items.map((item, index) => {
      const slot = slots[index];
      if (!slot) {
        update(item.id, {
          status: "error",
          error: "The server did not reserve a slot for this file",
        });
        return Promise.resolve();
      }
      return uploadOne(item, slot, queryClient);
    }),
  );
}

async function uploadOne(
  item: UploadItem,
  slot: PresignedFileDto,
  queryClient: QueryClient,
): Promise<void> {
  const { update } = useUploadStore.getState();
  update(item.id, {
    name: slot.finalName,
    status: "uploading",
    progress: 0,
    error: null,
  });

  await acquireSlot();
  try {
    await putFile(slot.uploadUrl, item.file, (progress) =>
      update(item.id, { progress }),
    );

    update(item.id, { status: "completing", progress: 100 });
    await apiFetch<NodeDto>(`/files/${slot.nodeId}/complete`, {
      method: "POST",
    });

    update(item.id, { status: "done" });
    // The file only becomes listable once it is READY, so the folder it landed
    // in is refetched here rather than optimistically inserted.
    void queryClient.invalidateQueries({
      queryKey: queryKeys.children(item.folderId),
    });
  } catch (error) {
    // A failed *new* file is holding its name, so release it or retrying would
    // collide with the failed attempt and land as "report (1).pdf". A failed
    // new version holds nothing - the existing file is untouched until
    // /complete swaps it - so deleting the node there would destroy the very
    // file the user was replacing.
    if (slot.action !== "versioned") await discardReservation(slot.nodeId);
    update(item.id, { status: "error", error: errorMessage(error) });
  } finally {
    releaseSlot();
  }
}

async function discardReservation(nodeId: string): Promise<void> {
  try {
    await apiFetch<void>(`/nodes/${nodeId}`, { method: "DELETE" });
  } catch {
    // Best effort. An abandoned UPLOADING row never appears in a listing, and
    // failing the retry over a bit of stranded bookkeeping would be worse.
  }
}
