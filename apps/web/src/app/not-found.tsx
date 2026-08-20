import Link from "next/link";
import { FileQuestionIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusScreen } from "@/components/status-screen";

/**
 * Any address that matches no route. Deliberately says nothing about whether
 * something once lived here - the same reason a node you do not own answers
 * 404 rather than 403.
 */
export default function NotFound() {
  return (
    <StatusScreen
      icon={<FileQuestionIcon />}
      title="Page not found"
      description="That address doesn’t lead anywhere. It may have been mistyped, or the item behind it may be gone."
      action={
        <Button variant="outline" size="sm" render={<Link href="/" />}>
          Go to your data room
        </Button>
      }
    />
  );
}
