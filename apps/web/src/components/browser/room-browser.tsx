"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FilterIcon,
  FolderIcon,
  FolderPlusIcon,
  MoreHorizontalIcon,
  Share2Icon,
} from "lucide-react";
import { toast } from "sonner";
import type { NodeDto, NodeType } from "@dataroom/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrowserFilters } from "@/components/browser/browser-filters";
import { EmptyState } from "@/components/browser/empty-state";
import {
  FileBrowser,
  type FolderTarget,
} from "@/components/browser/file-browser";
import { FolderPeek } from "@/components/browser/folder-peek";
import { PathBreadcrumbs } from "@/components/browser/path-breadcrumbs";
import { SelectionToolbar } from "@/components/browser/selection-toolbar";
import { DeleteConfirmDialog } from "@/components/dialogs/delete-confirm-dialog";
import { MoveDialog } from "@/components/dialogs/move-dialog";
import { NewFolderDialog } from "@/components/dialogs/new-folder-dialog";
import { RenameDialog } from "@/components/dialogs/rename-dialog";
import { RenameRoomDialog } from "@/components/dialogs/rename-room-dialog";
import {
  ShareDialog,
  type ShareTarget,
} from "@/components/dialogs/share-dialog";
import { UploadButton } from "@/components/upload/upload-button";
import { UploadDropzone } from "@/components/upload/upload-dropzone";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { useChildren } from "@/hooks/use-children";
import { useDebounced } from "@/hooks/use-debounced";
import { useMoveNodes } from "@/hooks/use-node-mutations";
import { useNodeSelection } from "@/hooks/use-node-selection";
import { useRooms } from "@/hooks/use-rooms";
import { ApiError } from "@/lib/api";
import { useBrowserView } from "@/lib/browser-view-store";
import { downloadPath, requestDownload } from "@/lib/download";

/** A stable empty array, so a closed dialog is not a new prop every render. */
const NOTHING: NodeDto[] = [];

export function RoomBrowser({ folderId }: { folderId: string }) {
  const router = useRouter();
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<NodeDto | null>(null);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [renamingRoom, setRenamingRoom] = useState(false);
  // Both dialogs take a list, so one row and a whole selection open the same
  // dialog and take the same path to the server.
  const [moveTargets, setMoveTargets] = useState<NodeDto[]>(NOTHING);
  const [deleteTargets, setDeleteTargets] = useState<NodeDto[]>(NOTHING);

  // The sort is a preference, so it lives outside this component and survives
  // the remount that navigating to another folder causes. The filters describe
  // one folder's contents, so losing them on the way out is correct.
  const sort = useBrowserView((state) => state.sort);
  const direction = useBrowserView((state) => state.direction);
  const handleSort = useBrowserView((state) => state.toggleSort);

  const [typeFilter, setTypeFilter] = useState<NodeType | undefined>(undefined);
  const [filterText, setFilterText] = useState("");
  const filterQuery = useDebounced(filterText.trim(), 250);

  const children = useChildren(folderId, {
    sort,
    direction,
    type: typeFilter,
    q: filterQuery || undefined,
  });
  const breadcrumbs = useBreadcrumbs(folderId);
  const rooms = useRooms();

  const moveByDrag = useMoveNodes(folderId);
  const room = rooms.data?.[0] ?? null;
  const rootId = room?.rootNodeId ?? null;
  const childrenError = children.error;

  // The folder can disappear while it is open - deleted from another tab, or
  // in another session. The listing answers 404, and the only sensible place
  // left to be is the room's root.
  useEffect(() => {
    const isMissing =
      childrenError instanceof ApiError && childrenError.status === 404;

    if (isMissing && rootId && rootId !== folderId) {
      toast.error("That folder no longer exists");
      router.replace(`/room/${rootId}`);
    }
  }, [childrenError, rootId, folderId, router]);

  const items = children.data?.pages.flatMap((page) => page.items) ?? [];
  const isFiltered = typeFilter !== undefined || filterQuery.length > 0;

  // Scoped to the folder, and narrowed to what is on screen: a bulk action can
  // only ever reach rows the user can see. Items that leave the listing - moved
  // away, deleted, filtered out - leave the selection with it, so nothing has
  // to be cleared by hand once an operation succeeds.
  const selection = useNodeSelection(items, folderId);

  // Second from the end of the trail: the folder containing this one. Absent
  // at the room root, which has nowhere to go up to.
  const trail = breadcrumbs.data;
  const parent = trail && trail.length >= 2 ? trail[trail.length - 2] : null;
  const current = trail?.[trail.length - 1] ?? null;

  /** Saves a file without having to open it first. */
  async function handleDownload(node: NodeDto): Promise<void> {
    try {
      await requestDownload(downloadPath.own(node.id));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not download the file",
      );
    }
  }

  /**
   * Dropping rows onto a folder row moves them there. Dragging a row that is
   * part of the selection brings the whole selection along - see FileBrowser.
   *
   * A name clash cannot open a dialog here without throwing away the gesture
   * the user just made, so the offer to keep both rides along on the toast.
   */
  function handleDragMove(nodes: NodeDto[], target: FolderTarget): void {
    const [only] = nodes;

    const run = (onConflict: "fail" | "rename"): void => {
      moveByDrag.mutate(
        {
          nodeIds: nodes.map((node) => node.id),
          targetFolderId: target.id,
          onConflict,
        },
        {
          onSuccess: (moved) => {
            toast.success(describeDrop(nodes, moved, target.name));
          },
          onError: (error) => {
            if (error instanceof ApiError && error.status === 409) {
              toast.error(
                only && nodes.length === 1
                  ? `"${only.name}" already exists in "${target.name}"`
                  : error.message,
                { action: { label: "Keep both", onClick: () => run("rename") } },
              );
              return;
            }
            toast.error(error.message);
          },
        },
      );
    };

    run("fail");
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <PathBreadcrumbs
          items={breadcrumbs.data}
          isLoading={breadcrumbs.isLoading}
          onNavigate={(nodeId) => router.push(`/room/${nodeId}`)}
          renderPeek={(folder) => (
            <FolderPeek
              folderId={folder.id}
              folderName={folder.name}
              onSelect={(node) =>
                router.push(
                  node.type === "FOLDER"
                    ? `/room/${node.id}`
                    : `/file/${node.id}`,
                )
              }
              onOpenFolder={() => router.push(`/room/${folder.id}`)}
            />
          )}
        />
        <div className="flex shrink-0 items-center gap-2">
          {/* Shares whatever level is open, which is the only way to share the
              room itself: the root has no row of its own to act on. */}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              current &&
              setShareTarget({
                id: current.id,
                name: current.name,
                type: "FOLDER",
                isRoom: current.id === rootId,
              })
            }
            disabled={!current}
          >
            <Share2Icon />
            {/* The labels fold away on a phone, where three of them plus the
                trail do not fit across 375px. */}
            <span className="sr-only sm:not-sr-only">Share</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setNewFolderOpen(true)}>
            <FolderPlusIcon />
            <span className="sr-only sm:not-sr-only">New folder</span>
          </Button>
          <UploadButton folderId={folderId} alwaysLabelled={false} />
          {/* Only at the top: this acts on the room, and the room is what the
              top of the trail stands for. Deeper down the folder you are in
              has its own row one level up. */}
          {room && current?.id === rootId && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Data room options"
                  />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto min-w-40">
                <DropdownMenuItem onClick={() => setRenamingRoom(true)}>
                  Rename data room
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="mb-3 flex justify-end">
        <BrowserFilters
          type={typeFilter}
          onTypeChange={setTypeFilter}
          query={filterText}
          onQueryChange={setFilterText}
        />
      </div>

      <UploadDropzone folderId={folderId}>
        <div className="rounded-xl border">
          <FileBrowser
            items={items}
            isLoading={children.isLoading}
            error={children.error}
            onRetry={() => void children.refetch()}
            onOpenFolder={(node) => router.push(`/room/${node.id}`)}
            onOpenFile={(node) => router.push(`/file/${node.id}`)}
            hasNextPage={children.hasNextPage}
            isFetchingNextPage={children.isFetchingNextPage}
            onLoadMore={() => void children.fetchNextPage()}
            onMoveNodes={handleDragMove}
            selection={selection}
            sorting={{ sort, direction, onSort: handleSort }}
            parentFolder={
              parent
                ? {
                    id: parent.id,
                    name: parent.name,
                    onOpen: () => router.push(`/room/${parent.id}`),
                    onDrop: (nodes) => handleDragMove(nodes, parent),
                  }
                : null
            }
            emptyState={
              isFiltered ? (
                // An empty result under a filter is not an empty folder, and
                // offering to upload here would be answering a question nobody
                // asked.
                <EmptyState
                  icon={<FilterIcon />}
                  title="Nothing here matches"
                  description="No item in this folder matches the current filter."
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTypeFilter(undefined);
                        setFilterText("");
                      }}
                    >
                      Clear the filter
                    </Button>
                  }
                />
              ) : (
              <EmptyState
                icon={<FolderIcon />}
                title="This folder is empty"
                description="Drop PDF files here to upload them, or create a folder."
                action={
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNewFolderOpen(true)}
                    >
                      <FolderPlusIcon />
                      New folder
                    </Button>
                    <UploadButton folderId={folderId} />
                  </div>
                }
              />
              )
            }
            renderRowActions={(node) => (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${node.name}`}
                    />
                  }
                >
                  <MoreHorizontalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-auto min-w-32">
                  {/* Folders have nothing to download: a zip of a subtree is a
                      streaming job, not a signed URL. */}
                  {node.type === "FILE" && (
                    <DropdownMenuItem onClick={() => void handleDownload(node)}>
                      Download
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setRenameTarget(node)}>
                    Rename
                  </DropdownMenuItem>
                  {/* The row menu acts on its own row even when others are
                      ticked: it is labelled for this item, and Rename and
                      Share have no meaning spread across a selection. */}
                  <DropdownMenuItem onClick={() => setMoveTargets([node])}>
                    Move
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShareTarget(node)}>
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteTargets([node])}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />
        </div>
      </UploadDropzone>

      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        parentId={folderId}
      />
      <RenameDialog
        node={renameTarget}
        folderId={folderId}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      />
      <MoveDialog
        nodes={moveTargets}
        folderId={folderId}
        onOpenChange={(open) => {
          if (!open) setMoveTargets(NOTHING);
        }}
      />
      <ShareDialog
        node={shareTarget}
        onOpenChange={(open) => {
          if (!open) setShareTarget(null);
        }}
      />
      <DeleteConfirmDialog
        nodes={deleteTargets}
        folderId={folderId}
        onOpenChange={(open) => {
          if (!open) setDeleteTargets(NOTHING);
        }}
      />

      <RenameRoomDialog
        room={renamingRoom ? room : null}
        onOpenChange={(open) => {
          if (!open) setRenamingRoom(false);
        }}
      />

      <SelectionToolbar
        nodes={selection.nodes}
        onMove={() => setMoveTargets(selection.nodes)}
        onDelete={() => setDeleteTargets(selection.nodes)}
        onClear={selection.clear}
      />
    </div>
  );
}

/**
 * What a drag-and-drop move did, naming the destination - the whole point of
 * the gesture was to put things somewhere, so the confirmation should say
 * where. Auto-suffixed names are called out; unchanged ones are not worth a
 * mention.
 */
function describeDrop(
  before: NodeDto[],
  after: NodeDto[],
  targetName: string,
): string {
  const namesBefore = new Map(before.map((node) => [node.id, node.name]));
  const renamed = after.filter((node) => namesBefore.get(node.id) !== node.name);

  const [only] = after;
  if (after.length === 1 && only) {
    return renamed.length === 0
      ? `Moved “${only.name}” to “${targetName}”`
      : `Moved to “${targetName}” as “${only.name}”`;
  }

  return renamed.length === 0
    ? `Moved ${after.length} items to “${targetName}”`
    : `Moved ${after.length} items to “${targetName}”, renaming ${renamed.length}`;
}
