import type { ReactNode } from "react";

interface StatusScreenProps {
  /** Optional: some notices read better as words alone. */
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

/**
 * A whole page that says why there is nothing to show.
 *
 * Distinct from EmptyState, which sits inside a listing that is otherwise
 * working. This one replaces the page: a dead link, a bad URL, a crash. They
 * share a shape so that hitting one never feels like leaving the product.
 */
export function StatusScreen({
  icon,
  title,
  description,
  action,
}: StatusScreenProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      {icon && (
        <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full [&_svg]:size-5">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-lg font-medium">{title}</p>
        <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      </div>
      {action}
    </div>
  );
}
