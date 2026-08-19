"use client";

import { useMe } from "@/hooks/use-me";

export default function HomePage() {
  const { data: me, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex min-h-[50vh] items-center justify-center text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-1 text-center">
      <p className="text-lg font-medium">Welcome, {me?.name}</p>
      <p className="text-muted-foreground text-sm">{me?.email}</p>
    </div>
  );
}
