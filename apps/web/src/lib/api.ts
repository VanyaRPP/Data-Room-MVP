import { apiErrorShape } from "@dataroom/shared";

export class ApiError extends Error {
  readonly status: number;
  readonly gone: boolean;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.gone = status === 410;
  }
}

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * Every API call goes through the same-origin /api/* rewrite (see
 * next.config.ts), so this never needs a base URL, CORS mode, or manual
 * credential wiring beyond the default same-origin cookie behavior.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const response = await fetch(`/api${path}`, {
    ...rest,
    credentials: "same-origin",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    const parsed = apiErrorShape.safeParse(data);
    if (parsed.success) return parsed.data.message;
  } catch {
    // Response body wasn't JSON (e.g. an upstream proxy error page).
  }
  return response.statusText || "Something went wrong. Please try again.";
}
