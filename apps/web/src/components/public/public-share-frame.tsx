"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { PublicShareDto } from "@dataroom/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusScreen } from "@/components/status-screen";
import { ShareGoneScreen } from "@/components/public/share-gone-screen";
import { isGone, usePublicShare } from "@/hooks/use-public";
import { ApiError } from "@/lib/api";

/**
 * Resolves the share link once and renders the right thing for its state, so
 * each public page only has to describe what to show when the link is good.
 */
export function PublicShareFrame({
  token,
  children,
}: {
  token: string;
  children: (share: PublicShareDto) => ReactNode;
}) {
  const share = usePublicShare(token);

  if (isGone(share.error)) return <ShareGoneScreen />;

  // A restricted link opened by the wrong person - or nobody - is not a dead
  // link, and saying so is what tells them signing in might actually help.
  if (share.error instanceof ApiError && share.error.status === 401) {
    return (
      <StatusScreen
        title="Sign in to view this"
        description="This item was shared with specific people. Sign in with the address it was sent to."
        action={
          <Button
            size="sm"
            render={
              <Link href={`/login?next=${encodeURIComponent(`/s/${token}`)}`} />
            }
          >
            Sign in
          </Button>
        }
      />
    );
  }

  if (share.error instanceof ApiError && share.error.status === 403) {
    return (
      <StatusScreen
        title="You do not have access"
        description="This item was shared with specific people, and your account is not one of them. Ask the owner to share it with this address."
      />
    );
  }

  if (share.error) {
    return (
      <StatusScreen
        title="Could not open this link"
        description={share.error.message}
        action={
          <Button variant="outline" size="sm" onClick={() => void share.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (!share.data) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 px-6 py-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return <>{children(share.data)}</>;
}
