"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  FolderIcon,
  LinkIcon,
  Share2Icon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { SharedByMeItem } from "@dataroom/shared";
import { EmptyState } from "@/components/browser/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRevokeShare } from "@/hooks/use-shares";
import { useSharedByMe } from "@/hooks/use-shares";
import { formatDate, formatTimeUntil } from "@/lib/format";

/**
 * Everything the owner has given away, in one place.
 *
 * The share dialog answers "who can see this item?", which requires already
 * knowing which item to ask about. This answers the question that actually
 * matters before a deal closes - "what is out there?" - and is the only way to
 * find a link left on a folder several levels down.
 */
export default function SharedByMePage() {
  const shared = useSharedByMe();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-lg font-medium">Shared by me</h1>
      <p className="text-muted-foreground mb-4 text-sm">
        Every link and invitation you have handed out that is still live.
      </p>

      <div className="rounded-xl border">
        {shared.isError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="space-y-1">
              <p className="font-medium">Could not load your shares</p>
              <p className="text-muted-foreground text-sm">
                {shared.error.message}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void shared.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : !shared.data ? (
          <div className="space-y-3 p-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        ) : shared.data.length === 0 ? (
          <EmptyState
            icon={<Share2Icon />}
            title="You haven’t shared anything"
            description="Share a folder or a file and the link you create shows up here, so you can see and withdraw it later."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="w-40">Access</TableHead>
                <TableHead className="w-36">Expires</TableHead>
                <TableHead className="w-28">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shared.data.map((item) => (
                <ShareRow key={item.share.id} item={item} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function ShareRow({ item }: { item: SharedByMeItem }) {
  const { share, node, path } = item;
  const revoke = useRevokeShare(null);
  const [copied, setCopied] = useState(false);

  const url = `${window.location.origin}/s/${share.token}`;
  // The last entry is the item itself; what is above it is where it lives.
  const location = path.slice(0, -1).join(" / ");

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link.");
    }
  }

  return (
    <TableRow>
      <TableCell className="w-full max-w-0">
        <Link
          href={`/s/${share.token}`}
          className="flex min-w-0 items-center gap-2 hover:underline"
        >
          {node.type === "FOLDER" ? (
            <FolderIcon className="text-muted-foreground size-4 shrink-0" />
          ) : (
            <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </Link>
        {/* Two folders can share a name; where it sits is what tells them
            apart, and a link is worth being sure about before revoking it. */}
        {location && (
          <p className="text-muted-foreground truncate pl-6 text-xs">
            {location}
          </p>
        )}
      </TableCell>

      <TableCell>
        {share.mode === "PUBLIC" ? (
          <Badge variant="outline" className="gap-1">
            <LinkIcon className="size-3" />
            Anyone with the link
          </Badge>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge variant="secondary" className="cursor-default gap-1">
                  <UsersIcon className="size-3" />
                  {share.grants.length}{" "}
                  {share.grants.length === 1 ? "person" : "people"}
                </Badge>
              }
            />
            <TooltipContent className="max-w-64">
              {share.grants.map((grant) => grant.email).join(", ")}
            </TooltipContent>
          </Tooltip>
        )}
      </TableCell>

      <TableCell className="text-muted-foreground text-sm">
        {share.expiresAt ? (
          <Tooltip>
            <TooltipTrigger render={<span className="cursor-default" />}>
              {formatTimeUntil(share.expiresAt)}
            </TooltipTrigger>
            <TooltipContent>{formatDate(share.expiresAt)}</TooltipContent>
          </Tooltip>
        ) : (
          "Never"
        )}
      </TableCell>

      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {share.mode === "PUBLIC" && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void copy()}
              aria-label={`Copy the link to ${node.name}`}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() =>
              revoke.mutate(share.id, {
                onSuccess: () => toast.success(`Access to “${node.name}” revoked`),
                onError: (error) => toast.error(error.message),
              })
            }
            disabled={revoke.isPending}
          >
            {revoke.isPending ? "Revoking…" : "Revoke"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
