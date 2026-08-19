"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-semibold">Data Room</span>
        {me && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{me.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              Log out
            </Button>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
      {/* In the shell, not a page: uploads keep running as the user navigates. */}
      <UploadQueuePanel />
    </div>
  );
}
