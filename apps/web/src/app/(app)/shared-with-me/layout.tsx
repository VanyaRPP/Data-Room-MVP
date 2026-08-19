import type { Metadata } from "next";

// A server layout exists purely to title the page: the page itself is a client
// component, and only server components can export metadata.
export const metadata: Metadata = { title: "Shared with me — Data Room" };

export default function SharedWithMeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
