"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRooms } from "@/hooks/use-rooms";

/**
 * The app has no separate dashboard: there is one data room per user, so "/"
 * just forwards to its root folder.
 */
export default function HomePage() {
  const router = useRouter();
  const rooms = useRooms();
  const rootNodeId = rooms.data?.[0]?.rootNodeId;

  useEffect(() => {
    if (rootNodeId) router.replace(`/room/${rootNodeId}`);
  }, [rootNodeId, router]);

  if (rooms.isError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <div className="space-y-1">
          <p className="font-medium">Could not load your data room</p>
          <p className="text-muted-foreground text-sm">
            {rooms.error.message}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void rooms.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-6 py-6">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
