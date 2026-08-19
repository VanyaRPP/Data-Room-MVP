import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown for any dead share link. The wording stays vague on purpose: revoked,
 * deleted and never-existed are the same 410 from the API, because telling
 * them apart would confirm that a token was once real.
 */
export function ShareGoneScreen() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <LinkIcon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-medium">This item is no longer available</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          The owner may have removed it or revoked access to this link.
        </p>
      </div>
      <Button variant="outline" size="sm" render={<Link href="/" />}>
        Go to your data room
      </Button>
    </div>
  );
}
