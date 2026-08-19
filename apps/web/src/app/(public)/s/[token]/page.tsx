"use client";

import { useParams } from "next/navigation";
import { PublicBrowser } from "@/components/public/public-browser";
import { PublicFileView } from "@/components/public/public-file-view";
import { PublicShareFrame } from "@/components/public/public-share-frame";

/**
 * The share link itself. What it opens depends on what was shared: a folder
 * browses, a single file goes straight to the viewer.
 */
export default function PublicSharePage() {
  const params = useParams<{ token: string }>();

  return (
    <PublicShareFrame token={params.token}>
      {(share) =>
        share.root.type === "FOLDER" ? (
          <PublicBrowser share={share} folderId={share.root.id} />
        ) : (
          <PublicFileView share={share} fileId={share.root.id} />
        )
      }
    </PublicShareFrame>
  );
}
