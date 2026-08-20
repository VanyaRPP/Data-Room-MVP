import Link from "next/link";
import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Shared with you — Data Room",
  // A share link is a bearer credential; keep it out of search indexes.
  robots: { index: false, follow: false },
};

/**
 * The shell for share links. No account controls: a visitor here may well not
 * have an account, and the page is read-only by definition.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href="/" className="font-semibold">
          Data Room
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">Shared with you</span>
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
