"use client";

import { useParams } from "next/navigation";
import { PublicFileView } from "@/components/public/public-file-view";
import { PublicShareFrame } from "@/components/public/public-share-frame";

export default function PublicFilePage() {
  const params = useParams<{ token: string; fileId: string }>();

  return (
    <PublicShareFrame token={params.token}>
      {(share) => <PublicFileView share={share} fileId={params.fileId} />}
    </PublicShareFrame>
  );
}
