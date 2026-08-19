"use client";

import { useParams } from "next/navigation";
import { PublicBrowser } from "@/components/public/public-browser";
import { PublicShareFrame } from "@/components/public/public-share-frame";

export default function PublicFolderPage() {
  const params = useParams<{ token: string; folderId: string }>();

  return (
    <PublicShareFrame token={params.token}>
      {(share) => <PublicBrowser share={share} folderId={params.folderId} />}
    </PublicShareFrame>
  );
}
