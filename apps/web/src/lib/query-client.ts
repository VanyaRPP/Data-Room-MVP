import { QueryClient, isServer } from "@tanstack/react-query";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
      },
    },
  });
}

// Every server request needs its own QueryClient (never share state across
// requests/users), but the browser should reuse one singleton across
// re-renders and client-side navigations. This is the pattern TanStack Query
// recommends for the Next.js App Router.
let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (isServer) {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
