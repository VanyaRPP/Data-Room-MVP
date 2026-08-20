"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileTextIcon, FolderIcon, SearchIcon } from "lucide-react";
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
import { useSearch } from "@/hooks/use-search";
import { formatBytes, formatDate } from "@/lib/format";

export default function SearchPage() {
  // useSearchParams needs a Suspense boundary to prerender at build time.
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchResults />
    </Suspense>
  );
}

function SearchResults() {
  const router = useRouter();
  const query = useSearchParams().get("q") ?? "";
  const search = useSearch(query);

  const items = search.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      <h1 className="mb-1 text-lg font-medium">Search</h1>
      <p className="text-muted-foreground mb-4 text-sm">
        {query ? (
          <>
            Results for <span className="text-foreground">{query}</span>
          </>
        ) : (
          "Type in the search box above to look across your whole data room."
        )}
      </p>

      <div className="rounded-xl border">
        {search.isError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="space-y-1">
              <p className="font-medium">Search failed</p>
              <p className="text-muted-foreground text-sm">
                {search.error.message}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void search.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : query && search.isLoading ? (
          <SearchSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<SearchIcon />}
            title={query ? "Nothing matched" : "Search your data room"}
            description={
              query
                ? `No file or folder has a name containing "${query}".`
                : "Find any file or folder by name, wherever it lives."
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-28">Size</TableHead>
                  <TableHead className="w-36">Modified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(({ node, path }) => (
                  <TableRow key={node.id}>
                    <TableCell className="w-full max-w-0">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            node.type === "FOLDER"
                              ? `/room/${node.id}`
                              : `/file/${node.id}`,
                          )
                        }
                        className="flex w-full min-w-0 cursor-pointer flex-col items-start gap-0.5 text-left"
                      >
                        <span className="flex min-w-0 max-w-full items-center gap-2 hover:underline">
                          {node.type === "FOLDER" ? (
                            <FolderIcon className="text-muted-foreground size-4 shrink-0" />
                          ) : (
                            <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
                          )}
                          <span className="truncate">{node.name}</span>
                        </span>
                        {/* Two files can share a name; the path is what tells
                            them apart in a flat list. */}
                        <span className="text-muted-foreground max-w-full truncate pl-6 text-xs">
                          {path.join(" / ")}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatBytes(node.size)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(node.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {search.hasNextPage && (
              <div className="flex justify-center py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void search.fetchNextPage()}
                  disabled={search.isFetchingNextPage}
                >
                  {search.isFetchingNextPage ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="space-y-3 p-2">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-8 w-full" />
      ))}
    </div>
  );
}
