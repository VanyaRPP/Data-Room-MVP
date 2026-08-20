import type { Metadata } from "next";

// A server layout exists purely to title the page: the page itself is a client
// component, and only server components can export metadata.
export const metadata: Metadata = { title: "Shared by me — Data Room" };

export default function SharedByMeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
