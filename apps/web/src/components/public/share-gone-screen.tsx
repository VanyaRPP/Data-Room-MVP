import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusScreen } from "@/components/status-screen";

/**
 * Shown for any dead share link. The wording stays vague on purpose: revoked,
 * expired, deleted and never-existed are the same 410 from the API, because
 * telling them apart would confirm that a token was once real.
 */
export function ShareGoneScreen() {
  return (
    <StatusScreen
      icon={<LinkIcon />}
      title="This item is no longer available"
      description="The owner may have removed it or revoked access to this link."
      action={
        <Button variant="outline" size="sm" render={<Link href="/" />}>
          Go to your data room
        </Button>
      }
    />
  );
}
