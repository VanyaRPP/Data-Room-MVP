"use client";

import Link from "next/link";
import { FileTextIcon, FolderIcon, UsersIcon } from "lucide-react";
import { EmptyState } from "@/components/browser/empty-state";
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
import { useSharedWithMe } from "@/hooks/use-shares";
import { formatBytes, formatDate } from "@/lib/format";

export default function SharedWithMePage() {
  const shared = useSharedWithMe();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      <h1 className="mb-4 text-lg font-medium">Shared with me</h1>

      <div className="rounded-xl border">
        {shared.isError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="space-y-1">
              <p className="font-medium">Could not load shared items</p>
              <p className="text-muted-foreground text-sm">
                {shared.error.message}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void shared.refetch()}>
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
            icon={<UsersIcon />}
            title="Nothing shared with you yet"
            description="When someone shares a folder or file with your email address, it shows up here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-40">Shared by</TableHead>
                <TableHead className="w-28">Size</TableHead>
                <TableHead className="w-36">Shared on</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shared.data.map((item) => (
                <TableRow key={item.token}>
                  <TableCell className="w-full max-w-0">
                    <Link
                      href={`/s/${item.token}`}
                      className="flex min-w-0 items-center gap-2 hover:underline"
                    >
                      {item.node.type === "FOLDER" ? (
                        <FolderIcon className="text-muted-foreground size-4 shrink-0" />
                      ) : (
                        <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
                      )}
                      <span className="truncate">{item.node.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.sharedBy}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatBytes(item.node.size)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(item.sharedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
