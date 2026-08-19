import { useQuery } from "@tanstack/react-query";
import type { RoomDto } from "@dataroom/shared";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useRooms() {
  return useQuery({
    queryKey: queryKeys.rooms,
    queryFn: () => apiFetch<RoomDto[]>("/rooms"),
    // A user's set of rooms changes about never; refetching it on every
    // navigation would be pure noise.
    staleTime: 5 * 60_000,
  });
}
