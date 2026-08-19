"use client";

import { useParams, useRouter } from "next/navigation";
import { PathBreadcrumbs } from "@/components/browser/path-breadcrumbs";
import { PdfViewer } from "@/components/viewer/pdf-viewer";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";

export default function FilePage() {
  const params = useParams<{ fileId: string }>();
  const router = useRouter();
  const breadcrumbs = useBreadcrumbs(params.fileId);

  // The trail ends at the file itself, so it doubles as the file's name and
  // saves a second request just to look that up.
  const trail = breadcrumbs.data;
  const name = trail?.[trail.length - 1]?.name ?? "";

  return (
    <div className="mx-auto flex h-[calc(100vh-3.25rem)] w-full max-w-5xl flex-col gap-4 px-6 py-6">
      <PathBreadcrumbs
        items={trail}
        isLoading={breadcrumbs.isLoading}
        onNavigate={(nodeId) => router.push(`/room/${nodeId}`)}
      />
      <div className="min-h-0 flex-1">
        <PdfViewer fileId={params.fileId} name={name} />
      </div>
    </div>
  );
}
