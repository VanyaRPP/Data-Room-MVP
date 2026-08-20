/** Storage and upload limits, kept in one place so API and web never drift apart. */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_FILES_PER_BATCH = 20;
export const PDF_MIME_TYPE = "application/pdf";

/** Node naming rules. */
export const NODE_NAME_MAX_LENGTH = 255;

/** How long a signed view URL for a file stays valid. */
export const VIEW_URL_TTL_SECONDS = 10 * 60; // 10 minutes

/**
 * Default and max page size for cursor-paginated listings.
 *
 * Kept deliberately small so paging is visible in a demo data room that holds
 * a handful of documents; a real deployment would raise it.
 */
export const DEFAULT_PAGE_SIZE = 5;
export const MAX_PAGE_SIZE = 100;

/** How many matches the search box previews while typing. */
export const SEARCH_SUGGESTION_LIMIT = 6;

/** Session cookie name, shared so the web app can reference it (e.g. middleware). */
export const SESSION_COOKIE_NAME = "dr_session";
