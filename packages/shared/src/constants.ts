/** Storage and upload limits, kept in one place so API and web never drift apart. */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_FILES_PER_BATCH = 20;
export const PDF_MIME_TYPE = "application/pdf";

/** Node naming rules. */
export const NODE_NAME_MAX_LENGTH = 255;

/** How long a signed view URL for a file stays valid. */
export const VIEW_URL_TTL_SECONDS = 10 * 60; // 10 minutes

/** Default and max page size for cursor-paginated listings. */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

/** Session cookie name, shared so the web app can reference it (e.g. middleware). */
export const SESSION_COOKIE_NAME = "dr_session";
