"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InboxIcon, Share2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/components/search-box";
import { ThemeToggle } from "@/components/theme-toggle";
import { UploadConflictDialog } from "@/components/upload/upload-conflict-dialog";
import { UploadQueuePanel } from "@/components/upload/upload-queue-panel";
import { useMe } from "@/hooks/use-me";
import { apiFetch } from "@/lib/api";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me, isError } = useMe();

  // Defense in depth beyond middleware's cookie-presence check: a present
  // but expired/invalid session cookie still reaches this layout, and only
  // the API's JWT verification (via this 401) can tell the difference.
  useEffect(() => {
    if (isError) router.replace("/login");
  }, [isError, router]);

  const logout = useMutation({
    mutationFn: () => apiFetch("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login");
    },
  });

  if (isError) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:gap-4 sm:px-6">
        {/* Everything here is measured against a 375px phone: the labels fall
            away to their icons and the signed-in address goes entirely, since
            it is the one thing nobody needs reminding of. */}
        <nav className="flex shrink-0 items-center gap-3 sm:gap-4">
          <Link href="/" className="font-semibold">
            Data Room
          </Link>
          <NavLink href="/shared-with-me" icon={<InboxIcon className="size-4" />}>
            Shared with me
          </NavLink>
          <NavLink href="/shared-by-me" icon={<Share2Icon className="size-4" />}>
            Shared by me
          </NavLink>
        </nav>
        <div className="hidden flex-1 justify-center px-4 sm:flex">
          {/* SearchBox reads the query string, which opts its subtree out of
              static rendering. Without this boundary that bailout reaches the
              whole layout and no page under it can prerender at all. */}
          <Suspense fallback={<div className="h-8 w-full max-w-xs" />}>
            <SearchBox />
          </Suspense>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm sm:gap-3">
          <ThemeToggle />
          {me && (
            <>
              <span className="text-muted-foreground hidden lg:inline">
                {me.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                Log out
              </Button>
            </>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      {/* In the shell, not a page: uploads keep running as the user navigates. */}
      <UploadQueuePanel />
      <UploadConflictDialog />
    </div>
  );
}

/**
 * A header link that keeps its icon and drops its words on a narrow screen.
 * The label stays in the accessibility tree either way, so the link is never
 * an unlabelled glyph.
 */
function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: string;
}) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm"
    >
      {icon}
      <span className="sr-only md:not-sr-only">{children}</span>
    </Link>
  );
}
