"use client";

import { useParams } from "next/navigation";
import { RoomBrowser } from "@/components/browser/room-browser";

export default function RoomPage() {
  // useParams rather than the async `params` prop: this is a client component,
  // and every request it makes needs the session cookie from the browser.
  const params = useParams<{ folderId: string }>();

  return <RoomBrowser folderId={params.folderId} />;
}
