"use client";

import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusScreen } from "@/components/status-screen";

/**
 * The boundary for anything that throws while rendering a page.
 *
 * Without it, a crash shows the framework's own diagnostic screen - which
 * leaks internals in development and says nothing useful in production. `reset`
 * re-renders the subtree, which is enough to recover from a transient failure
 * without losing the session.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StatusScreen
      icon={<TriangleAlertIcon />}
      title="Something went wrong"
      description={
        error.digest
          ? `The page could not be displayed. Reference: ${error.digest}`
          : "The page could not be displayed."
      }
      action={
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={reset}>
            Try again
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/" />}>
            Go to your data room
          </Button>
        </div>
      }
    />
  );
}
