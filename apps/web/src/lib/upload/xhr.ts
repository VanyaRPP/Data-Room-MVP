import { PDF_MIME_TYPE } from "@dataroom/shared";

/**
 * Uploads a file body straight to storage.
 *
 * XMLHttpRequest rather than fetch: only XHR reports upload progress, and a
 * progress bar is the whole point of the queue panel.
 *
 * The Content-Type header is not optional. Storage records whatever is sent
 * here as the object's type, and the server rejects anything that isn't a PDF
 * when confirming the upload.
 */
export function putFile(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", PDF_MIME_TYPE);

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Storage rejected the upload (${request.status})`));
    });

    request.addEventListener("error", () =>
      reject(new Error("Connection lost during upload")),
    );
    request.addEventListener("timeout", () =>
      reject(new Error("The upload timed out")),
    );

    request.send(file);
  });
}
