import type { FileUrlDto } from "@dataroom/shared";
import { apiFetch } from "@/lib/api";

/**
 * Fetches a signed URL and hands the file to the browser to save.
 *
 * The URL is fetched at the moment of asking rather than kept ready: signed
 * URLs live ten minutes, so one minted when the page opened would often be
 * dead by the time anybody pressed anything.
 *
 * An anchor rather than assigning `location`: navigating the page away and
 * back would tear down whatever is on screen for what is not a navigation at
 * all. The `download` attribute is ignored cross-origin, so the filename comes
 * from the `Content-Disposition` the API asks storage to attach - without it a
 * saved file would be named after its storage key, which is a UUID.
 */
export async function requestDownload(urlPath: string): Promise<void> {
  const { url } = await apiFetch<FileUrlDto>(urlPath);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noreferrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

/** Where to ask for a file's bytes, as the owner or through a share link. */
export const downloadPath = {
  own: (fileId: string, version?: number) =>
    version === undefined
      ? `/files/${fileId}/url?download=true`
      : `/files/${fileId}/versions/${version}/url?download=true`,
  shared: (token: string, fileId: string) =>
    `/public/${token}/files/${fileId}/url?download=true`,
};
