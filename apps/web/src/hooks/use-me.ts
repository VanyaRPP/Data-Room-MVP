import { useQuery } from "@tanstack/react-query";
import type { UserDto } from "@dataroom/shared";
import { apiFetch } from "@/lib/api";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<UserDto>("/auth/me"),
  });
}
