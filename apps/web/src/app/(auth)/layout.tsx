"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMe } from "@/hooks/use-me";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: me } = useMe();

  // Renders the form immediately either way (the common case is a logged-out
  // visitor); only redirects away once we positively confirm a valid
  // session, rather than gating on the cookie's mere presence like
  // middleware does - see AppLayout for why that distinction matters.
  useEffect(() => {
    if (me) router.replace("/");
  }, [me, router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute top-3 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-xl font-semibold">Data Room</h1>
        {children}
      </div>
    </div>
  );
}
